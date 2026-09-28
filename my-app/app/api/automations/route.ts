import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, json, readJson, requireUserId, HttpError } from "@/lib/api";
import { num } from "@/lib/money";
import { createAutomation, describeAutomation } from "@/lib/automations/service";

export async function GET(req: Request) {
  try {
    const userId = await requireUserId();
    const mode = new URL(req.url).searchParams.get("mode");
    const automations = await prisma.automation.findMany({
      where: { userId, ...(mode === "LIVE" || mode === "PAPER" ? { mode } : {}), status: { not: "CANCELLED" } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100,
    });
    return json({
      automations: automations.map((a) => ({
        id: a.id, mode: a.mode, kind: a.kind, status: a.status, marketSlug: a.marketSlug, question: a.question, outcome: a.outcome,
        summary: describeAutomation(a), config: a.config, lastPrice: a.lastPrice === null ? null : num(a.lastPrice),
        lastCheckedAt: a.lastCheckedAt?.toISOString() ?? null, lastError: a.lastError, firedAt: a.firedAt?.toISOString() ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return fail(error);
  }
}

const body = z.object({
  mode: z.enum(["PAPER", "LIVE"]),
  kind: z.enum(["EXIT", "ENTRY", "WEBHOOK"]),
  marketSlug: z.string().trim().min(1).max(240),
  outcome: z.string().trim().min(1).max(120),
  config: z.record(z.string(), z.unknown()),
}).strict();

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError(parsed.error.issues[0]?.message ?? "Check the automation details.");
    const { automation, secret } = await createAutomation({ userId, ...parsed.data });
    // Never AUTH_URL: an apex domain that redirects to www breaks TradingView, which won't follow redirects.
    const origin = process.env.APP_URL || new URL(req.url).origin;
    return json({
      id: automation.id,
      summary: describeAutomation(automation),
      // Shown once: only a hash of the secret is stored.
      webhookUrl: secret ? `${origin.replace(/\/$/, "")}/api/hooks/${automation.id}/${secret}` : null,
    }, 201);
  } catch (error) {
    return fail(error);
  }
}
