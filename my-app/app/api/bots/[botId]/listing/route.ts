import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { KeeperhubClient } from "@/lib/keeperhub";
import { platformKeeperhubKey } from "@/lib/keeperhub-connection";
import { computeTrackRecord, type TrackRecord } from "@/lib/track-record";
import { attestPublication } from "@/lib/attestation";

const headers = { "Cache-Control": "private, no-store" };

async function recordFor(workflowId: string | null): Promise<TrackRecord | null> {
  const key = platformKeeperhubKey();
  if (!workflowId || workflowId.startsWith("local_") || !key) return null;
  const raw = (await new KeeperhubClient(key).getExecutions(workflowId)) as unknown as Record<string, unknown>[];
  return computeTrackRecord(raw);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bot = await prisma.bot.findFirst({ where: { id: (await params).botId, userId: session.user.id } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  let record: TrackRecord | null = null;
  try {
    record = await recordFor(bot.keeperhubWorkflowId);
  } catch {
    /* record stays null; the card renders an unavailable state */
  }
  return NextResponse.json(
    { listed: bot.listedAt !== null, listedAt: bot.listedAt, workflowId: bot.keeperhubWorkflowId, attestationTx: bot.attestationTx, record },
    { headers },
  );
}

// Publishing is gated on a verifiable record, not a self-declared one: a
// strategy cannot be listed until at least one of its trades has resolved
// on-chain, so the feed never carries unproven strategies.
export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const list = (await req.json().catch(() => null))?.list !== false;
  const bot = await prisma.bot.findFirst({ where: { id: (await params).botId, userId: session.user.id } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  if (!list) {
    await prisma.bot.update({ where: { id: bot.id }, data: { listedAt: null } });
    return NextResponse.json({ listed: false }, { headers });
  }

  const record = await recordFor(bot.keeperhubWorkflowId).catch(() => null);
  if (!record) return NextResponse.json({ error: "Strategy has no on-platform history to verify." }, { status: 400 });
  if (record.resolved < 1) {
    return NextResponse.json({ error: "A strategy needs at least one resolved trade before it can be listed.", record }, { status: 422 });
  }

  const attestation = bot.attestationTx ? { txHash: bot.attestationTx, link: `https://sepolia.etherscan.io/tx/${bot.attestationTx}`, chainId: 11155111 } : await attestPublication(bot.id).catch(() => null);
  await prisma.bot.update({ where: { id: bot.id }, data: { listedAt: new Date(), attestationTx: attestation?.txHash ?? bot.attestationTx } });
  return NextResponse.json({ listed: true, record, attestation }, { headers });
}
