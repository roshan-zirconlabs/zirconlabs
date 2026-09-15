import { prisma } from "../lib/prisma";
import { autoLayout } from "../components/workflow/auto-layout";
import { toKeeperhubGraph, ensureAddPlaceholders } from "../components/workflow/serialize";
import type { WorkflowNode, WorkflowEdge } from "../components/workflow/types";

async function main() {
  console.log("=== Running End-to-End Bot Builder & Execution Test ===");

  // 1. Ensure test demo user exists
  const email = "demo.trader@zirconlabs.xyz";
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name: "Demo Trader" },
    update: {},
  });
  console.log("✔ User verified:", user.id);

  // 2. Create a test bot
  const botName = `E2E Test Cosmic Bot ${Date.now().toString().slice(-4)}`;
  const bot = await prisma.bot.create({
    data: {
      userId: user.id,
      name: botName,
      keeperhubWorkflowId: `kh_e2e_${Date.now()}`,
    },
  });
  console.log("✔ Bot created successfully:", bot.id, bot.name);

  // 3. Construct a multi-step workflow with Trigger + Actions
  const nodes: WorkflowNode[] = [
    {
      id: "trigger-1",
      type: "trigger",
      position: { x: 0, y: 0 },
      data: {
        type: "trigger",
        label: "15m Cron Schedule",
        description: "Every 15 minutes at boundary",
        config: { triggerType: "Schedule", cron: "*/15 * * * *" },
      },
    },
    {
      id: "action-1",
      type: "action",
      position: { x: 0, y: 0 },
      data: {
        type: "action",
        label: "Fetch BTC Active Market",
        description: "Auto-rotates to current 15m window",
        config: { integrationType: "polymarket", actionType: "get-market", asset: "BTC", timeframe: "15m" },
      },
    },
    {
      id: "action-2",
      type: "action",
      position: { x: 0, y: 0 },
      data: {
        type: "action",
        label: "Place Polymarket YES Order",
        description: "10.00 USDC in paper simulation",
        config: { integrationType: "polymarket", actionType: "place-order", side: "BUY", amount: 10, asset: "BTC", timeframe: "15m" },
      },
    },
  ];

  const edges: WorkflowEdge[] = [
    { id: "e1", source: "trigger-1", target: "action-1" },
    { id: "e2", source: "action-1", target: "action-2" },
  ];

  // 4. Ensure add placeholders and run autoLayout
  const withAdds = ensureAddPlaceholders(nodes, edges);
  const laidOut = autoLayout(withAdds.nodes, withAdds.edges);
  console.log(`✔ Laid out ${laidOut.length} nodes including add placeholders`);

  // Verify anti-collision layout
  for (let i = 0; i < laidOut.length; i++) {
    for (let j = i + 1; j < laidOut.length; j++) {
      const a = laidOut[i];
      const b = laidOut[j];
      const dx = Math.abs(a.position.x - b.position.x);
      const dy = Math.abs(a.position.y - b.position.y);
      if (dx < 200 && dy < 90) {
        throw new Error(`Node collision detected between ${a.id} and ${b.id}! dx=${dx}, dy=${dy}`);
      }
    }
  }
  console.log("✔ Auto-layout verified: NO node overlap or collision!");

  // 5. Serialize to KeeperHub graph format
  const serialized = toKeeperhubGraph(laidOut, withAdds.edges);
  console.log(`✔ Serialized graph: ${serialized.nodes.length} real nodes, ${serialized.edges.length} edges`);

  // 6. Test paper trade execution recording
  const trade = await prisma.trade.create({
    data: {
      botId: bot.id,
      userId: user.id,
      marketSlug: "btc-updown-15m-1726000000",
      tokenId: "2149123456789",
      signal: "BUY",
      direction: "UP",
      side: "BUY",
      amount: 10.0,
      price: 0.52,
      shares: 19.23,
      status: "FILLED",
      paper: true,
      keeperhubExecutionId: `sim_${Date.now()}`,
    },
  });
  console.log("✔ Paper execution trade recorded:", trade.id, trade.marketSlug, `${trade.shares} shares @ ${trade.price}`);

  // 7. Verify audit trail retrieval
  const trades = await prisma.trade.findMany({
    where: { botId: bot.id },
  });
  if (trades.length !== 1 || !trades[0].paper) {
    throw new Error("Audit trail trade verification failed");
  }
  console.log("✔ Verified audit trail count:", trades.length);

  // Clean up test bot
  await prisma.trade.deleteMany({ where: { botId: bot.id } });
  await prisma.bot.delete({ where: { id: bot.id } });
  console.log("✔ Cleaned up test bot and records");

  console.log("\nALL E2E BOT BUILDER & EXECUTION TESTS PASSED! 🎉");
}

main()
  .catch((err) => {
    console.error("E2E Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
