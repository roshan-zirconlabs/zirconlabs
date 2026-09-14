import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET() {
  const missing = [
    ["DATABASE_URL", process.env.DATABASE_URL],
    ["AUTH_SECRET", process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET],
    ["GOOGLE_CLIENT_ID", process.env.GOOGLE_CLIENT_ID],
    ["GOOGLE_CLIENT_SECRET", process.env.GOOGLE_CLIENT_SECRET],
    ["ENCRYPTION_KEY", /^[a-f0-9]{64}$/i.test(process.env.ENCRYPTION_KEY ?? "") ? "valid" : ""],
  ].filter(([, value]) => !value).map(([name]) => name);
  const managedWallets = Boolean(process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET);
  return NextResponse.json({ status: missing.length ? "misconfigured" : "configured", missing, optionalMissing: managedWallets ? [] : ["PRIVY_APP_ID", "PRIVY_APP_SECRET"], capabilities: { managedWallets, polymarketLive: managedWallets && process.env.POLYMARKET_LIVE_ENABLED === "true" && process.env.POLYMARKET_CLOB_V2_ADAPTER_READY === "true" }, checks: "Configuration only; not a database or upstream connectivity probe." }, { status: missing.length ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
