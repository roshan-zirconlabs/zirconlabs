import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { strategySpec, describeStrategy } from "@/lib/workflow/strategy";
import { keeperhub } from "@/lib/keeperhub";
import { compileStrategyWorkflow } from "@/lib/workflow/compile";
import { getHostedSchemas, validateHostedGraph, KeeperhubCatalogError } from "@/lib/workflow-validation";
import { tradingDepositWallet } from "@/lib/polymarket/account";
import { keeperhubForUser, platformWorkflowName } from "@/lib/keeperhub-connection";

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
  // A webhook-triggered bot is only usable once it is published, because the
  // alert URL belongs to the KeeperHub workflow.
  const alertUrl = spec.success && spec.data.source === "webhook" && bot.keeperhubWorkflowId
    ? keeperhub.webhookUrl(bot.keeperhubWorkflowId)
    : null;
  return NextResponse.json({
    bot: { id: bot.id, name: bot.name, status: bot.status, keeperhubWorkflowId: bot.keeperhubWorkflowId },
    strategy: spec.success ? spec.data : null,
    summary: spec.success ? describeStrategy(spec.data) : null,
    alertUrl,
  }, { headers });
}

/** Saves the strategy and rebuilds the workflow graph it publishes to KeeperHub. */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const bot = await prisma.bot.findFirst({ where: { id: (await params).botId, userId: session.user.id } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const raw = await req.json().catch(() => null);
  const parsed = strategySpec.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the strategy settings." }, { status: 400, headers });
  }
  const spec = parsed.data;
  // The canvas can rename the bot while saving its strategy; the guided builder
  // sends no name and leaves it unchanged.
  const rawName = typeof raw === "object" && raw ? (raw as { name?: unknown }).name : undefined;
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim().slice(0, 100) : undefined;

  let tradingWalletAddress: string | null = null;
  if (spec.mode === "live") {
    const account = await prisma.polymarketManagedAccount.findUnique({
      where: { userId: session.user.id },
    });
    if (account && account.status === "ACTIVE" && account.liveEnabled) {
      try { tradingWalletAddress = await tradingDepositWallet(account); } catch { /* balance node is best-effort */ }
    }
    if (!account || account.status !== "ACTIVE" || !account.liveEnabled) {
      return NextResponse.json({
        error: "Fund your trading account and turn on live trading before saving a live strategy.",
        code: "LIVE_ACCOUNT_REQUIRED",
      }, { status: 409, headers });
    }
  }

  let graph;
  try {
    graph = compileStrategyWorkflow(bot.id, spec, tradingWalletAddress);
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
    data: { strategy: spec, workflow: JSON.parse(JSON.stringify(graph)), ...(name ? { name } : {}) },
  });

  // A change to an already-published bot must take effect immediately, not
  // only on the next manual "Publish & activate" click — otherwise KeeperHub
  // keeps running the previous graph (e.g. still in the previous paper/live
  // mode) with no visible sign that the save did nothing.
  let republished = false;
  const workflowId = bot.keeperhubWorkflowId?.startsWith("local_") ? null : bot.keeperhubWorkflowId;
  if (bot.status === "ACTIVE" && workflowId) {
    try {
      const { client: kh } = await keeperhubForUser(session.user.id);
      await kh.updateWorkflow(workflowId, graph);
      republished = true;
    } catch (error) {
      return NextResponse.json({
        ok: true, strategy: spec, summary: describeStrategy(spec), nodes: graph.nodes.length, republished: false,
        error: `Saved, but the live workflow on KeeperHub was not updated: ${error instanceof Error ? error.message : "unknown error"}. It is still running the previous version — try saving again.`,
      }, { status: 200, headers });
    }
  } else if (bot.status === "ACTIVE" && !workflowId) {
    // Save it as a platform-hosted workflow instead of publishing blind
    try {
      const { client: kh, source } = await keeperhubForUser(session.user.id);
      const wf = await kh.createWorkflow({ name: source === "platform" ? platformWorkflowName(bot.name, bot.id) : bot.name, ...graph });
      await kh.updateWorkflow(wf.id, { enabled: true });
      await prisma.bot.update({ where: { id: bot.id }, data: { keeperhubWorkflowId: wf.id } });
      republished = true;
    } catch { /* Bot stays ACTIVE locally with no workflow; the bot detail page surfaces this. */ }
  }

  return NextResponse.json({ ok: true, strategy: spec, summary: describeStrategy(spec), nodes: graph.nodes.length, republished }, { headers });
}
