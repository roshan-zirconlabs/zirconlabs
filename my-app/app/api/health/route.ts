import { NextResponse } from "next/server";
import { checkDatabase, checkDeploymentConfig } from "@/lib/deployment-health";
import { probeAuthDatabase } from "@/lib/auth-database-probe";
import { liveExecutionConfigured } from "@/lib/polymarket/managed-account";
import { readServerRegion } from "@/lib/polymarket/geoblock";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** How long the runner may go quiet before it counts as stopped. */
const RUNNER_STALE_MS = 5 * 60 * 1000;

export async function GET(request: Request) {
  const { missing, issues, callbackUrl, publicOrigin } = checkDeploymentConfig(process.env, request.url);
  const database = missing.includes("DATABASE_URL") ? { status: "unavailable", code: "DATABASE_URL_MISSING" } : await checkDatabase(probeAuthDatabase);
  const managedWallets = Boolean(process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);
  const polymarketLive = liveExecutionConfigured();
  // Where Polymarket sees this server's orders coming from. Only matters once
  // live trading is on, but is always reported so a bad region shows early.
  const region = await readServerRegion();
  if (polymarketLive && (region.status === "close-only" || region.status === "blocked")) {
    issues.push({ code: "POLYMARKET_REGION_CLOSE_ONLY", message: `Polymarket sees this server in ${region.country}, where new positions cannot be opened. Move the deployment to an allowed region.` });
  }
  if (!(process.env.CRON_SECRET ?? "").trim()) {
    issues.push({ code: "RUNNER_NOT_SCHEDULED", message: "Set CRON_SECRET and call /api/runner/tick every minute (Supabase pg_cron, cron-job.org, or yarn worker), or scheduled bots never run." });
  }
  // The runner records its last tick; a missing or old one means nothing is calling it.
  let runnerLastTickAt: string | null = null;
  if (database.status === "ok") {
    const beat = await prisma.runnerHeartbeat.findUnique({ where: { id: "runner" } }).catch(() => null);
    runnerLastTickAt = beat?.lastTickAt.toISOString() ?? null;
    if (!beat || Date.now() - beat.lastTickAt.getTime() > RUNNER_STALE_MS) {
      issues.push({ code: "RUNNER_STALE", message: "The bot runner has not ticked in the last 5 minutes. Check the scheduler that calls /api/runner/tick." });
    }
  }
  const ok = missing.length === 0 && database.status === "ok" && !issues.some(i => i.code.startsWith("AUTH_") || i.code === "DATABASE_URL_INVALID" || i.code === "POLYMARKET_REGION_CLOSE_ONLY");
  return NextResponse.json({ status: ok ? "healthy" : "unavailable", missing, issues, database, auth: { callbackUrl }, region, runner: { lastTickAt: runnerLastTickAt }, capabilities: { managedWallets, publicOrigin, polymarketLive }, checks: "Environment configuration, live auth database/schema query, runner heartbeat and Polymarket region. Google consent and funded trading are separate checks." }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
