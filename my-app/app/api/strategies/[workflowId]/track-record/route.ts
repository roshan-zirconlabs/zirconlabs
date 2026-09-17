import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { KeeperhubClient } from "@/lib/keeperhub";
import { platformKeeperhubKey } from "@/lib/keeperhub-connection";
import { computeTrackRecord, toPublicRecord } from "@/lib/track-record";

const headers = { "Cache-Control": "public, max-age=60" };

// Public: anyone (including an agent deciding whether to pay) can read a listed
// strategy's verifiable track record. The proof array lets them recompute it
// from KeeperHub execution ids and on-chain conditionIds themselves.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId } = await params;
  const bot = await prisma.bot.findFirst({
    where: { keeperhubWorkflowId: workflowId, listedAt: { not: null } },
    select: { name: true, listedAt: true, attestationTx: true },
  });
  if (!bot) return NextResponse.json({ error: "No listed strategy for this workflow." }, { status: 404 });

  const key = platformKeeperhubKey();
  if (!key) return NextResponse.json({ error: "Workflow hosting is not configured." }, { status: 503 });

  try {
    const raw = (await new KeeperhubClient(key).getExecutions(workflowId)) as unknown as Record<string, unknown>[];
    const record = toPublicRecord(await computeTrackRecord(raw));
    return NextResponse.json({ workflowId, name: bot.name, listedAt: bot.listedAt, attestationTx: bot.attestationTx, ...record }, { headers });
  } catch {
    return NextResponse.json({ error: "Track record is unavailable right now." }, { status: 502 });
  }
}
