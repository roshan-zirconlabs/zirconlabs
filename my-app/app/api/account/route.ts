import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, json, readJson, requireUserId, HttpError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { num } from "@/lib/money";
import { ManagedWalletError, liveTradingAvailable, managedWalletConfigured, provisionManagedWallet } from "@/lib/polymarket/managed-account";
import { tradingDepositWallet } from "@/lib/polymarket/account";
import { collateralBalance } from "@/lib/polymarket/account-readiness";

async function view(userId: string) {
  const account = await prisma.tradingAccount.findUnique({ where: { userId } });
  let balanceUsd: number | null = null;
  let depositWallet = account?.depositWalletAddress ?? null;
  if (account) {
    try {
      depositWallet = await tradingDepositWallet(account);
      balanceUsd = (await collateralBalance(depositWallet)).usd;
    } catch { /* Shown as unavailable rather than $0. */ }
  }
  return {
    walletsConfigured: managedWalletConfigured(),
    liveAvailable: liveTradingAvailable(),
    account: account && {
      depositWallet, balanceUsd, liveEnabled: account.liveEnabled, paused: account.paused,
      dailyLimitUsd: num(account.dailyLimitUsd), createdAt: account.createdAt.toISOString(),
    },
  };
}

export async function GET() {
  try {
    return json(await view(await requireUserId()));
  } catch (error) {
    return fail(error);
  }
}

/** Creates the user's live trading wallet. Safe to call twice. */
export async function POST() {
  try {
    const userId = await requireUserId();
    const existing = await prisma.tradingAccount.findUnique({ where: { userId } });
    if (!existing) {
      if (!managedWalletConfigured()) throw new HttpError("Live wallets aren't configured on this deployment yet.", 503);
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
      try {
        const wallet = await provisionManagedWallet(userId, user.email);
        await prisma.tradingAccount.create({ data: { userId, providerWalletId: wallet.id, signerAddress: wallet.address } });
      } catch (error) {
        if (error instanceof ManagedWalletError) throw new HttpError(error.message, error.status);
        throw error;
      }
      await logActivity({ userId, mode: "LIVE", title: "Live trading wallet created", detail: "Deposit funds to start trading live." });
    }
    return json(await view(userId), existing ? 200 : 201);
  } catch (error) {
    return fail(error);
  }
}

const patch = z.object({
  liveEnabled: z.boolean().optional(),
  dailyLimitUsd: z.number().finite().min(1).max(10000).optional(),
  paused: z.boolean().optional(),
}).strict();

export async function PATCH(req: Request) {
  try {
    const userId = await requireUserId();
    const parsed = patch.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError("Daily limit must be between $1 and $10,000.");
    const account = await prisma.tradingAccount.findUnique({ where: { userId } });
    if (!account) throw new HttpError("Create your trading wallet first.", 404);
    if (parsed.data.liveEnabled && !liveTradingAvailable()) throw new HttpError("Live trading isn't switched on for this deployment yet.", 409);
    await prisma.tradingAccount.update({ where: { userId }, data: parsed.data });
    if (parsed.data.paused !== undefined && parsed.data.paused !== account.paused) {
      await logActivity({
        userId, mode: "LIVE", level: parsed.data.paused ? "WARNING" : "SUCCESS",
        title: parsed.data.paused ? "Kill switch on: all live trading paused" : "Kill switch off: live trading resumed",
      });
    }
    if (parsed.data.liveEnabled !== undefined && parsed.data.liveEnabled !== account.liveEnabled) {
      await logActivity({ userId, mode: "LIVE", title: parsed.data.liveEnabled ? "Live trading turned on" : "Live trading turned off" });
    }
    return json(await view(userId));
  } catch (error) {
    return fail(error);
  }
}
