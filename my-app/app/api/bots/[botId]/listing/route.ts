import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeTrackRecord, type TrackRecord } from "@/lib/track-record";
import { executionsForBot } from "@/lib/run-history";

const headers = { "Cache-Control": "private, no-store" };

async function recordFor(bot: { id: string }): Promise<TrackRecord | null> {
  return computeTrackRecord(await executionsForBot(bot.id));
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bot = await prisma.bot.findFirst({ where: { id: (await params).botId, userId: session.user.id } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  let record: TrackRecord | null = null;
  try {
    record = await recordFor(bot);
  } catch {
    /* record stays null; the card renders an unavailable state */
  }
  return NextResponse.json(
    { listed: bot.listedAt !== null, listedAt: bot.listedAt, workflowId: bot.id, record },
    { headers },
  );
}

// Publishing is gated on a verifiable record, not a self-declared one: a
// strategy cannot be listed until at least one of its trades has resolved
// on-chain, so the feed never carries unproven strategies.
export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) ?? {};
  const list = body.list !== false;
  const bot = await prisma.bot.findFirst({ where: { id: (await params).botId, userId: session.user.id } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  if (!list) {
    await prisma.bot.update({ where: { id: bot.id }, data: { listedAt: null } });
    return NextResponse.json({ listed: false }, { headers });
  }

  const record = await recordFor(bot).catch(() => null);
  if (!record) return NextResponse.json({ error: "Strategy has no on-platform history to verify." }, { status: 400 });
  if (record.resolved < 1) {
    return NextResponse.json({ error: "A strategy needs at least one resolved trade before it can be listed.", record }, { status: 422 });
  }

  await prisma.bot.update({ where: { id: bot.id }, data: { listedAt: bot.listedAt ?? new Date() } });
  return NextResponse.json({ listed: true, record }, { headers });
}
