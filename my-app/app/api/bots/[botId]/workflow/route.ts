import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { keeperhubForUser } from "@/lib/keeperhub-connection";
import { graphSchema, getHostedSchemas, validateHostedGraph } from "@/lib/workflow-validation";
import { z } from "zod";

type RouteParams = { params: Promise<{ botId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bot = await prisma.bot.findFirst({ where: { id: (await params).botId, userId: session.user.id } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  if (bot.workflow) return NextResponse.json({ bot, name: bot.name, ...graphSchema.parse(bot.workflow) });
  if (bot.keeperhubWorkflowId && !bot.keeperhubWorkflowId.startsWith("local_")) {
    try {
      const remote = await (await keeperhubForUser(session.user.id)).client.getWorkflow(bot.keeperhubWorkflowId);
      return NextResponse.json({ bot, name: bot.name, nodes: remote.nodes, edges: remote.edges });
    } catch { return NextResponse.json({ error: "Your hosted workflow could not be loaded. Reconnect KeeperHub and retry; no draft was replaced." }, { status: 502 }); }
  }
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
  // Persist drafts first, even when a remote host or custom plugin is unavailable.
  await prisma.bot.update({ where: { id: bot.id }, data: { name, workflow: JSON.parse(JSON.stringify({ nodes, edges })) } });
  if (bot.keeperhubWorkflowId && !bot.keeperhubWorkflowId.startsWith("local_")) {
    try {
      validateHostedGraph({ nodes, edges }, await getHostedSchemas());
      await (await keeperhubForUser(session.user.id)).client.updateWorkflow(bot.keeperhubWorkflowId, { name, nodes, edges });
    } catch (error) {
      return NextResponse.json({ error: `Draft saved locally, but KeeperHub was not updated. ${error instanceof Error ? error.message : "Retry synchronization."}`, draftSaved: true }, { status: 502 });
    }
  }
  return NextResponse.json({ ok: true, name, nodes, edges });
}
