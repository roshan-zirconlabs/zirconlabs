import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { keeperhubForUser, platformWorkflowName } from "@/lib/keeperhub-connection";
import { getHostedSchemas, validateHostedGraph } from "@/lib/workflow-validation";

export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (typeof body?.active !== "boolean") return NextResponse.json({ error: "Specify active as true or false." }, { status: 400 });
  const bot = await prisma.bot.findFirst({ where: { id: (await params).botId, userId: session.user.id } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  try {
    const { client: kh, source } = await keeperhubForUser(session.user.id);
    let id = bot.keeperhubWorkflowId?.startsWith("local_") ? null : bot.keeperhubWorkflowId;
    if (body.active) {
      const input = bot.workflow ?? (id ? await kh.getWorkflow(id) : null);
      const graph = validateHostedGraph(input, await getHostedSchemas());
      if (!id) {
        // In the shared platform organization the name carries the owning bot,
        // so a run in KeeperHub is always traceable back to one Zircon bot.
        const wf = await kh.createWorkflow({ name: source === "platform" ? platformWorkflowName(bot.name, bot.id) : bot.name, ...graph });
        id = wf.id;
        // Save the identity before enabling so a retry never creates a second schedule.
        await prisma.bot.update({ where: { id: bot.id }, data: { keeperhubWorkflowId: id } });
      } else await kh.updateWorkflow(id, graph);
    }
    if (id) await kh.updateWorkflow(id, { enabled: body.active });
    const updated = await prisma.bot.update({ where: { id: bot.id }, data: { status: body.active ? "ACTIVE" : "INACTIVE" } });
    return NextResponse.json({ ...updated, editorUrl: id ? kh.editorUrl(id) : null, webhookUrl: id ? kh.webhookUrl(id) : null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "KeeperHub activation failed. Local status was not changed." }, { status: 502 });
  }
}
