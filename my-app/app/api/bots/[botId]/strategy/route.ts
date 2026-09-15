import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { strategySpec, describeStrategy } from "@/lib/workflow/strategy";
import { compileStrategyWorkflow } from "@/lib/workflow/compile";
import { getHostedSchemas, validateHostedGraph, KeeperhubCatalogError } from "@/lib/workflow-validation";

type RouteParams = { params: Promise<{ botId: string }> };
const headers = { "Cache-Control": "private, no-store" };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bot = await prisma.bot.findFirst({
    where: { id: (await params).botId, userId: session.user.id },
    select: { id: true, name: true, status: true, strategy: true, keeperhubWorkflowId: true },
  });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  const spec = strategySpec.safeParse(bot.strategy);
  return NextResponse.json({
    bot: { id: bot.id, name: bot.name, status: bot.status, keeperhubWorkflowId: bot.keeperhubWorkflowId },
    strategy: spec.success ? spec.data : null,
    summary: spec.success ? describeStrategy(spec.data) : null,
  }, { headers });
}

/** Saves the strategy and rebuilds the workflow graph it publishes to KeeperHub. */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bot = await prisma.bot.findFirst({ where: { id: (await params).botId, userId: session.user.id } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const parsed = strategySpec.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the strategy settings." }, { status: 400, headers });
  }
  const spec = parsed.data;

  if (spec.mode === "live") {
    const account = await prisma.polymarketManagedAccount.findUnique({
      where: { userId: session.user.id }, select: { status: true, liveEnabled: true },
    });
    if (!account || account.status !== "ACTIVE" || !account.liveEnabled) {
      return NextResponse.json({
        error: "Fund your trading account and turn on live trading before saving a live strategy.",
        code: "LIVE_ACCOUNT_REQUIRED",
      }, { status: 409, headers });
    }
  }

  let graph;
  try {
    graph = compileStrategyWorkflow(bot.id, spec);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The strategy could not be compiled." }, { status: 500, headers });
  }

  // Validate against the live catalog so a save never produces a graph that
  // cannot later be published.
  try {
    validateHostedGraph(graph, await getHostedSchemas());
  } catch (error) {
    const code = error instanceof KeeperhubCatalogError ? error.code : "WORKFLOW_INVALID";
    return NextResponse.json({ error: error instanceof Error ? error.message : "The compiled workflow was rejected.", code }, { status: 502, headers });
  }

  await prisma.bot.update({
    where: { id: bot.id },
    data: { strategy: spec, workflow: JSON.parse(JSON.stringify(graph)) },
  });

  return NextResponse.json({ ok: true, strategy: spec, summary: describeStrategy(spec), nodes: graph.nodes.length }, { headers });
}
