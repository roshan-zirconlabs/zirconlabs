import { NextRequest, NextResponse } from "next/server";
import { transferErc20 } from "@polymarket/client/actions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createManagedPolymarketClient } from "@/lib/polymarket/live-client";
import { managedWalletConfigured } from "@/lib/polymarket/managed-account";
import { readAccountReadiness } from "@/lib/polymarket/account-readiness";
import { tradingDepositWallet } from "@/lib/polymarket/account";
import { assertDestination, assertSameWithdrawal, resolveAmount, withdrawInput, WithdrawError, COLLATERAL_DECIMALS } from "@/lib/polymarket/withdraw";
import { formatUnits } from "viem";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };

/** Polymarket collateral on Polygon. https://docs.polymarket.com/resources/contracts */
const COLLATERAL_TOKEN = "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB";

/** Prior withdrawals, so the user can see what left and where it went. */
export async function GET() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const withdrawals = await prisma.walletWithdrawal.findMany({
    where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 20,
    select: { id: true, destination: true, amountUsd: true, status: true, txHash: true, error: true, createdAt: true },
  });
  return NextResponse.json({
    withdrawals: withdrawals.map(w => ({
      ...w, amountUsd: Number(w.amountUsd),
      explorerUrl: w.txHash ? `https://polygonscan.com/tx/${w.txHash}` : null,
    })),
  }, { headers });
}

/**
 * Moves collateral out of the user's trading wallet to an address they name.
 *
 * The request is recorded before the transfer is signed, so a retry or a
 * timeout can never send the same withdrawal twice, and a submission whose
 * outcome is unknown stays unknown rather than being reported either way.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = withdrawInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a destination address and amount, then confirm the withdrawal." }, { status: 400, headers });
  }
  const input = parsed.data;

  if (!managedWalletConfigured()) {
    return NextResponse.json({ error: "Managed trading accounts are not configured on this deployment." }, { status: 503, headers });
  }
  const account = await prisma.polymarketManagedAccount.findUnique({ where: { userId: session.user.id } });
  if (!account) return NextResponse.json({ error: "You do not have a trading account yet." }, { status: 409, headers });

  let recordId: string | null = null;
  try {
    const depositWallet = await tradingDepositWallet(account);
    const destination = assertDestination(input.destination, depositWallet);
    const readiness = await readAccountReadiness(depositWallet);
    const amount = resolveAmount(input.amount, readiness.balance);
    const amountUsd = formatUnits(amount, COLLATERAL_DECIMALS);

    const previous = await prisma.walletWithdrawal.findUnique({
      where: { userId_requestId: { userId: session.user.id, requestId: input.requestId } },
    });
    if (previous) {
      assertSameWithdrawal(previous, destination, amount);
      return NextResponse.json({
        ok: previous.status === "SENT", status: previous.status, txHash: previous.txHash,
        explorerUrl: previous.txHash ? `https://polygonscan.com/tx/${previous.txHash}` : null,
        message: "This withdrawal was already submitted. It was not sent again.",
      }, { status: previous.status === "SENT" ? 200 : 202, headers });
    }

    // Claim the request before signing: a throw after this point leaves a
    // record, which is exactly the case where a blind retry would double-send.
    const record = await prisma.walletWithdrawal.create({
      data: { userId: session.user.id, requestId: input.requestId, destination, amountUsd },
    });
    recordId = record.id;

    const client = await createManagedPolymarketClient(account.providerWalletId, account.walletAddress);
    const handle = await transferErc20(client, { amount, recipientAddress: destination, tokenAddress: COLLATERAL_TOKEN });
    const txHash = handle.transactionHash;

    await prisma.walletWithdrawal.update({
      where: { id: record.id },
      data: { status: txHash ? "SENT" : "SUBMITTED", txHash: txHash ?? null },
    });

    return NextResponse.json({
      ok: true, status: txHash ? "SENT" : "SUBMITTED", amountUsd, destination, txHash,
      explorerUrl: txHash ? `https://polygonscan.com/tx/${txHash}` : null,
      message: txHash
        ? "Withdrawal submitted. It settles once the Polygon transaction confirms."
        : "Withdrawal accepted and is being submitted. Check its status before sending another.",
    }, { headers });
  } catch (error) {
    if (error instanceof WithdrawError) {
      if (recordId) await prisma.walletWithdrawal.update({ where: { id: recordId }, data: { status: "FAILED", error: error.message } }).catch(() => {});
      return NextResponse.json({ error: error.message }, { status: error.status, headers });
    }
    if (recordId) {
      // The transfer may have reached the chain. Reporting failure here would
      // invite a retry that sends the money a second time.
      await prisma.walletWithdrawal.update({ where: { id: recordId }, data: { status: "UNKNOWN", error: "Outcome could not be confirmed." } }).catch(() => {});
      return NextResponse.json({
        status: "UNKNOWN",
        error: "The withdrawal may have been submitted. Do not retry it. Check your wallet's recent activity on Polygonscan first.",
      }, { status: 202, headers });
    }
    return NextResponse.json({ error: "The withdrawal could not be prepared. Nothing was sent." }, { status: 502, headers });
  }
}
