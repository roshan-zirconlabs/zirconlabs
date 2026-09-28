import crypto from "crypto";
import { NextResponse } from "next/server";
import { runTick } from "@/lib/engine/tick";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Runs one engine pass. Called every minute by Vercel Cron (which sends
 * `Authorization: Bearer $CRON_SECRET`) or any external scheduler. The
 * always-on worker (`yarn worker`) runs the same pass every few seconds.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (secret.length < 16 || got.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(secret))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const report = await runTick(50_000);
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
