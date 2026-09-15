import { NextResponse } from "next/server";
import { checkDatabase, checkDeploymentConfig } from "@/lib/deployment-health";
import { probeAuthDatabase } from "@/lib/auth-database-probe";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const { missing, issues, callbackUrl } = checkDeploymentConfig(process.env, request.url);
  const database = missing.includes("DATABASE_URL") ? { status: "unavailable", code: "DATABASE_URL_MISSING" } : await checkDatabase(probeAuthDatabase);
  const managedWallets = Boolean(process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);
  const ok = missing.length === 0 && database.status === "ok" && !issues.some(i => i.code.startsWith("AUTH_") || i.code === "DATABASE_URL_INVALID");
  return NextResponse.json({ status: ok ? "healthy" : "unavailable", missing, issues, database, auth: { callbackUrl }, capabilities: { managedWallets, polymarketLive: managedWallets && process.env.POLYMARKET_LIVE_ENABLED === "true" && process.env.POLYMARKET_CLOB_V2_ADAPTER_READY === "true" }, checks: "Environment configuration and live auth database/schema query. Google consent and funded trading are separate checks." }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
