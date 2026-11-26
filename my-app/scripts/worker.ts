/**
 * Runs the PolyTrade runner in a loop, for hosting on a VM or container
 * instead of calling /api/runner/tick from a scheduler. Overlapping ticks are
 * safe: each market window is claimed once in the database.
 *
 *   yarn worker
 */
import { runScheduledBots } from "../lib/runner/run";
import { prisma } from "../lib/prisma";

const INTERVAL_MS = 30_000;
let stopping = false;

async function loop() {
  while (!stopping) {
    const started = Date.now();
    try {
      const summary = await runScheduledBots();
      if (summary.due > 0) console.log(new Date().toISOString(), JSON.stringify(summary));
    } catch (error) {
      console.error(new Date().toISOString(), "tick failed:", error instanceof Error ? error.message : error);
    }
    const wait = Math.max(1_000, INTERVAL_MS - (Date.now() - started));
    await new Promise(resolve => setTimeout(resolve, wait));
  }
  await prisma.$disconnect().catch(() => {});
  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { stopping = true; });
console.log("PolyTrade runner started; ticking every", INTERVAL_MS / 1000, "seconds");
void loop();
