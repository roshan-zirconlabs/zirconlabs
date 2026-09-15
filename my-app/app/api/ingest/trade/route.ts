import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bearerBotId } from "@/lib/workflow/bot-token";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

/**
 * Mirrors a trade that a user's own KeeperHub workflow performed, for bots built
 * on the advanced node canvas rather than the guided strategy builder.
 *
 * The bearer token authorises exactly one bot, so a workflow can only ever write
 * to the bot it belongs to.
 */
const payload = z.object({
  marketSlug: z.string().trim().min(1).max(240),
  tokenId: z.string().trim().regex(/^\d+$/, "tokenId must be a Polymarket token id"),
  direction: z.enum(["UP", "DOWN"]),
  side: z.enum(["BUY", "SELL"]).default("BUY"),
  sizeUsd: z.coerce.number().finite().positive().max(10000),
  price: z.coerce.number().finite().gt(0).lt(1),
  paper: z.coerce.boolean().default(true),
  orderId: z.string().trim().max(120).optional(),
  executionId: z.string().trim().min(1).max(200),
  runId: z.string().trim().max(200).optional(),
  submittedAt: z.iso.datetime().optional(),
});

export async function POST(req: NextRequest) {
  const botId = bearerBotId(req);
  if (!botId) {
    return NextResponse.json({ error: "Invalid or missing bot callback token." }, { status: 401, headers });
  }
  const parsed = payload.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the trade fields." }, { status: 400, headers });
  }
  const body = parsed.data;

  const bot = await prisma.bot.findUnique({ where: { id: botId }, select: { id: true, userId: true } });
  if (!bot) return NextResponse.json({ error: "Unknown bot." }, { status: 404, headers });

  // Scope the execution id to the bot so two bots cannot collide on one id.
  const executionId = `${bot.id}:${body.executionId}`;
  const trade = await prisma.trade.upsert({
    where: { keeperhubExecutionId: executionId },
    create: {
      userId: bot.userId, botId: bot.id,
      signal: body.side, side: body.side, direction: body.direction,
      marketSlug: body.marketSlug, tokenId: body.tokenId,
      amount: body.sizeUsd, price: body.price, status: "FILLED",
      orderId: body.orderId ?? null,
      executedAt: body.submittedAt ? new Date(body.submittedAt) : new Date(),
      keeperhubExecutionId: executionId, keeperhubRunId: body.runId ?? null, paper: body.paper,
    },
    update: { status: "FILLED", price: body.price, amount: body.sizeUsd },
  });
  return NextResponse.json({ ok: true, tradeId: trade.id }, { headers });
}
