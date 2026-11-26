import { NextRequest, NextResponse } from "next/server";
import { computeTrackRecord, toPublicRecord } from "@/lib/track-record";
import { executionsForBot, findListedBot } from "@/lib/run-history";

const headers = { "Cache-Control": "public, max-age=60" };

// Public: anyone can read a published strategy's track record. Every settled
// trade carries its on-chain condition id, and `basis` says whether it is
// scored on real orders or simulated fills.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId } = await params;
  const bot = await findListedBot(workflowId);
  if (!bot) return NextResponse.json({ error: "No listed strategy for this id." }, { status: 404 });

  try {
    const raw = await executionsForBot(bot.id);
    const record = toPublicRecord(await computeTrackRecord(raw));
    return NextResponse.json({ workflowId, name: bot.name, listedAt: bot.listedAt, ...record }, { headers });
  } catch {
    return NextResponse.json({ error: "Track record is unavailable right now." }, { status: 502 });
  }
}
