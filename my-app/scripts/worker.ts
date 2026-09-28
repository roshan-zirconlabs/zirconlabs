/**
 * Always-on automation engine: runs a tick every few seconds so stop-losses
 * react in seconds, not minutes. Run anywhere with the app's env:
 *
 *   yarn worker
 *
 * Safe alongside the /api/cron/tick route — automations are leased and orders
 * are idempotent, so overlapping runs never double-trade.
 */
import { runTick } from "../lib/engine/tick";
import { prisma } from "../lib/prisma";

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 5000);
let stopping = false;

process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

async function main() {
  console.log(`[worker] started, every ${INTERVAL_MS}ms`);
  while (!stopping) {
    const started = Date.now();
    try {
      const r = await runTick(40_000);
      if (r.fired || r.errors || r.settled || r.claimed || r.reconciled || r.alerts) {
        console.log(`[worker] ${new Date().toISOString()} checked=${r.checked} fired=${r.fired} settled=${r.settled} claimed=${r.claimed} reconciled=${r.reconciled} alerts=${r.alerts} errors=${r.errors} ${r.ms}ms`);
      }
    } catch (error) {
      console.error("[worker] tick failed", error);
    }
    const wait = Math.max(0, INTERVAL_MS - (Date.now() - started));
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  await prisma.$disconnect();
  console.log("[worker] stopped");
  // Pooled DB and HTTP connections would otherwise keep the process alive.
  process.exit(0);
}

main();
