import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { strategySpec } from "@/lib/workflow/strategy";
import { alertUrl } from "@/lib/runner/hosting";
import { PLANS, effectivePlan } from "@/lib/billing/plans";

/** Turns a bot on or off. An active bot runs on its schedule or on its alerts. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (typeof body?.active !== "boolean") return NextResponse.json({ error: "Specify active as true or false." }, { status: 400 });
  const bot = await prisma.bot.findFirst({ where: { id: (await params).botId, userId: session.user.id } });
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  // Only strategies the runner understands can run: a bot is one trigger, one
  // rule and one order, so it cannot be turned into an unbounded graph.
  const spec = strategySpec.safeParse(bot.strategy);
  if (body.active && !spec.success) {
    return NextResponse.json({ error: "Save a strategy first (guided setup, or a Place order block in the visual editor)." }, { status: 409 });
  }

  // A plan caps how many bots run at once.
  if (body.active && bot.status !== "ACTIVE") {
    const [sub, running] = await Promise.all([
      prisma.subscription.findUnique({ where: { userId: session.user.id } }),
      prisma.bot.count({ where: { userId: session.user.id, status: "ACTIVE" } }),
    ]);
    const plan = effectivePlan(sub);
    const limit = PLANS[plan].activeBots;
    if (running >= limit) {
      return NextResponse.json({
        error: `Your ${PLANS[plan].name} plan runs ${limit} bot${limit === 1 ? "" : "s"} at a time. Pause one, or upgrade on the Plans page.`,
        code: "PLAN_LIMIT",
      }, { status: 403 });
    }
  }

  const updated = await prisma.bot.update({ where: { id: bot.id }, data: { status: body.active ? "ACTIVE" : "INACTIVE" } });
  return NextResponse.json({
    ...updated,
    webhookUrl: spec.success && spec.data.source === "webhook" ? alertUrl(bot.id, req.nextUrl.origin) : null,
  });
}
