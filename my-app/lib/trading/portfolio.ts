import "server-only";
import type { TradingMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { num } from "@/lib/money";
import { getLivePositions, getMidpoints } from "@/lib/polymarket/prices";
import { collateralBalance } from "@/lib/polymarket/account-readiness";
import { tradingDepositWallet } from "@/lib/polymarket/account";

export type Holding = {
  tokenId: string;
  conditionId: string;
  marketSlug: string;
  question: string;
  outcome: string;
  shares: number;
  avgPrice: number;
  price: number | null;
  valueUsd: number;
  costUsd: number;
  pnlUsd: number;
  endDate: string | null;
  image: string | null;
  claimable: boolean;
};

export type Portfolio = {
  mode: TradingMode;
  cashUsd: number;
  holdings: Holding[];
  positionsValueUsd: number;
  /** Set when the live book couldn't be read; the page shows it instead of zeros. */
  unavailable?: string;
  depositWallet?: string | null;
};

export async function heldShares(userId: string, mode: TradingMode, tokenId: string): Promise<number> {
  if (mode === "PAPER") {
    const p = await prisma.paperPosition.findUnique({ where: { userId_tokenId: { userId, tokenId } } });
    return p && !p.settledAt ? num(p.shares) : 0;
  }
  const account = await prisma.tradingAccount.findUnique({ where: { userId } });
  if (!account) return 0;
  const wallet = await tradingDepositWallet(account);
  return (await getLivePositions(wallet)).find((p) => p.tokenId === tokenId)?.shares ?? 0;
}

export async function getPortfolio(userId: string, mode: TradingMode): Promise<Portfolio> {
  if (mode === "PAPER") {
    const [user, positions] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { paperCash: true } }),
      prisma.paperPosition.findMany({ where: { userId, settledAt: null, shares: { gt: 0.000001 } }, orderBy: { updatedAt: "desc" } }),
    ]);
    const mids = positions.length ? await getMidpoints(positions.map((p) => p.tokenId)).catch(() => new Map<string, number>()) : new Map<string, number>();
    const holdings = positions.map((p): Holding => {
      const shares = num(p.shares);
      const cost = num(p.costUsd);
      const price = mids.get(p.tokenId) ?? null;
      const value = price === null ? cost : shares * price;
      return {
        tokenId: p.tokenId, conditionId: p.conditionId, marketSlug: p.marketSlug, question: p.question, outcome: p.outcome,
        shares, avgPrice: shares > 0 ? cost / shares : 0, price, valueUsd: value, costUsd: cost, pnlUsd: value - cost,
        endDate: p.endDate?.toISOString() ?? null, image: null, claimable: false,
      };
    });
    return { mode, cashUsd: num(user.paperCash), holdings, positionsValueUsd: holdings.reduce((s, h) => s + h.valueUsd, 0) };
  }

  const account = await prisma.tradingAccount.findUnique({ where: { userId } });
  if (!account) return { mode, cashUsd: 0, holdings: [], positionsValueUsd: 0, depositWallet: null };
  try {
    const wallet = await tradingDepositWallet(account);
    const [balance, positions] = await Promise.all([collateralBalance(wallet), getLivePositions(wallet)]);
    const holdings = positions.map((p): Holding => ({
      tokenId: p.tokenId, conditionId: p.conditionId, marketSlug: p.marketSlug, question: p.question, outcome: p.outcome,
      shares: p.shares, avgPrice: p.avgPrice, price: p.price, valueUsd: p.valueUsd, costUsd: p.costUsd, pnlUsd: p.pnlUsd,
      endDate: p.endDate, image: p.image, claimable: p.claimable,
    }));
    return { mode, cashUsd: balance.usd, holdings, positionsValueUsd: holdings.reduce((s, h) => s + h.valueUsd, 0), depositWallet: wallet };
  } catch {
    return { mode, cashUsd: 0, holdings: [], positionsValueUsd: 0, unavailable: "Your live balance and positions couldn't be read from Polymarket right now." };
  }
}
