import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { liveTradingAvailable, managedWalletConfigured } from "@/lib/polymarket/managed-account";
import { telegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Names what's missing — never values. */
export async function GET() {
  const required = ["DATABASE_URL", "AUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "CRON_SECRET"] as const;
  const missing = required.filter((k) => !(k === "AUTH_SECRET" ? process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET : process.env[k])?.trim());
  let database = "ok";
  try {
    await prisma.$queryRaw`SELECT 1 FROM "User" LIMIT 1`;
  } catch {
    database = "unavailable";
  }
  // The engine is healthy if it ran recently; automations have lastCheckedAt.
  const lastRun = await prisma.automation.findFirst({ where: { lastCheckedAt: { not: null } }, orderBy: { lastCheckedAt: "desc" }, select: { lastCheckedAt: true } }).catch(() => null);
  const ok = missing.length === 0 && database === "ok";
  return NextResponse.json({
    status: ok ? "healthy" : "unavailable", missing, database,
    engineLastRunAt: lastRun?.lastCheckedAt?.toISOString() ?? null,
    capabilities: { liveWallets: managedWalletConfigured(), liveTrading: liveTradingAvailable(), telegram: telegramConfigured() },
  }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
