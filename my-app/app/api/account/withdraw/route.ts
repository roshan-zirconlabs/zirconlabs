import { transferErc20 } from "@polymarket/client/actions";
import { formatUnits } from "viem";
import { prisma } from "@/lib/prisma";
import { fail, json, readJson, requireUserId, HttpError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { num } from "@/lib/money";
import { createManagedPolymarketClient } from "@/lib/polymarket/live-client";
import { managedWalletConfigured } from "@/lib/polymarket/managed-account";
import { tradingDepositWallet } from "@/lib/polymarket/account";
import { collateralBalance, COLLATERAL_TOKEN } from "@/lib/polymarket/account-readiness";
import { assertDestination, assertSameWithdrawal, resolveAmount, withdrawInput, WithdrawError, COLLATERAL_DECIMALS } from "@/lib/polymarket/withdraw";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const userId = await requireUserId();
    const rows = await prisma.withdrawal.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 });
    return json({
      withdrawals: rows.map((w) => ({
        id: w.id, destination: w.destination, amountUsd: num(w.amountUsd), status: w.status, error: w.error,
        explorerUrl: w.txHash ? `https://polygonscan.com/tx/${w.txHash}` : null, createdAt: w.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return fail(error);
  }
}

/**
 * Sends collateral to an address the user names. The request is recorded
 * before signing, so a retry or timeout can never send it twice, and an
 * outcome we can't confirm is reported as unknown, never as failed.
 */
export async function POST(req: Request) {
  let recordId: string | null = null;
  let userId = "";
  try {
    userId = await requireUserId();
    const parsed = withdrawInput.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError("Enter a destination address and amount, then confirm.");
    if (!managedWalletConfigured()) throw new HttpError("Live wallets aren't configured on this deployment.", 503);
    const account = await prisma.tradingAccount.findUnique({ where: { userId } });
    if (!account) throw new HttpError("You don't have a trading wallet yet.", 409);

    const wallet = await tradingDepositWallet(account);
    const destination = assertDestination(parsed.data.destination, wallet);
    const amount = resolveAmount(parsed.data.amount, (await collateralBalance(wallet)).raw);
    const amountUsd = formatUnits(amount, COLLATERAL_DECIMALS);

    const previous = await prisma.withdrawal.findUnique({ where: { userId_requestId: { userId, requestId: parsed.data.requestId } } });
    if (previous) {
      assertSameWithdrawal(previous, destination, amount);
      return json({ status: previous.status, explorerUrl: previous.txHash ? `https://polygonscan.com/tx/${previous.txHash}` : null, message: "Already submitted — it was not sent again." }, 200);
    }
    const record = await prisma.withdrawal.create({ data: { userId, requestId: parsed.data.requestId, destination, amountUsd } });
    recordId = record.id;

    const client = await createManagedPolymarketClient(account.providerWalletId);
    const handle = await transferErc20(client, { amount, recipientAddress: destination, tokenAddress: COLLATERAL_TOKEN });
    const txHash = handle.transactionHash ?? null;
    await prisma.withdrawal.update({ where: { id: record.id }, data: { status: txHash ? "SENT" : "SUBMITTED", txHash } });
    await logActivity({ userId, mode: "LIVE", level: "SUCCESS", title: `Withdrew $${Number(amountUsd).toFixed(2)} to ${destination.slice(0, 6)}…${destination.slice(-4)}`, detail: txHash ? `https://polygonscan.com/tx/${txHash}` : undefined });
    return json({ status: txHash ? "SENT" : "SUBMITTED", explorerUrl: txHash ? `https://polygonscan.com/tx/${txHash}` : null, message: "Withdrawal sent. It arrives once the Polygon transaction confirms." });
  } catch (error) {
    if (error instanceof WithdrawError) {
      if (recordId) await prisma.withdrawal.update({ where: { id: recordId }, data: { status: "FAILED", error: error.message } }).catch(() => {});
      return json({ error: error.message }, error.status);
    }
    if (recordId) {
      // It may have reached the chain; reporting failure would invite a double send.
      await prisma.withdrawal.update({ where: { id: recordId }, data: { status: "UNKNOWN", error: "Outcome could not be confirmed." } }).catch(() => {});
      if (userId) await logActivity({ userId, mode: "LIVE", level: "ERROR", title: "Withdrawal outcome unknown — don't retry yet", detail: "Check your wallet on Polygonscan first." }).catch(() => {});
      return json({ status: "UNKNOWN", error: "The withdrawal may have been sent. Don't retry — check Polygonscan first." }, 202);
    }
    return fail(error);
  }
}
