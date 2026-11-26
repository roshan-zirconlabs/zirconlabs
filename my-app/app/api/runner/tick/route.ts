import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { runScheduledBots } from "@/lib/runner/run";
import { scanPayments } from "@/lib/billing/chain";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16) return false;
  const given = (req.headers.get("authorization") ?? "").replace(/^bearer\s+/i, "");
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * One PolyTrade runner tick: evaluates every scheduled bot whose market window
 * is due. Safe to call every minute from any scheduler; overlapping calls
 * evaluate each window once.
 */
async function tick(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const summary = await runScheduledBots();
  // Payments are matched here too, so a paid plan applies within a minute.
  // A billing failure never stops the bots.
  const payments = await scanPayments().catch((error: unknown) => ({ error: error instanceof Error ? error.message.slice(0, 120) : "scan failed" }));
  return NextResponse.json({ ok: true, at: new Date().toISOString(), ...summary, payments }, { headers });
}

export const GET = tick;
export const POST = tick;
