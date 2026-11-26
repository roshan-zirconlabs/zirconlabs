import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { graphSchema } from "@/lib/workflow-validation";
import { z } from "zod";

type RouteParams = { params: Promise<{ botId: string }> };
const MAX_DRAFT_NODES = 8;

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bot = await prisma.bot.findFirst({ where: { id: (await params).botId, userId: session.user.id } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  if (bot.workflow) return NextResponse.json({ bot, name: bot.name, ...graphSchema.parse(bot.workflow) });
  return NextResponse.json({ bot, name: bot.name, nodes: [], edges: [] });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bot = await prisma.bot.findFirst({ where: { id: (await params).botId, userId: session.user.id } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  const parsed = graphSchema.extend({ name: z.string().trim().min(1).max(100) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid workflow. Use a name, up to 100 nodes and valid edges." }, { status: 400 });
  const { name, nodes, edges } = parsed.data;
  // A bot is one trigger, a rule and an order. Drafts are bounded so the canvas
  // cannot grow into a graph the runner would never execute.
  if (nodes.length > MAX_DRAFT_NODES) {
    return NextResponse.json({ error: `A bot can have at most ${MAX_DRAFT_NODES} steps.` }, { status: 400 });
  }
  if (nodes.filter(n => (n.data?.type ?? n.type) === "trigger").length > 1) {
    return NextResponse.json({ error: "A bot has exactly one trigger." }, { status: 400 });
  }
  await prisma.bot.update({ where: { id: bot.id }, data: { name, workflow: JSON.parse(JSON.stringify({ nodes, edges })) } });
  return NextResponse.json({ ok: true, name, nodes, edges });
}
