import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, json, readJson, requireUserId } from "@/lib/api";
import { num } from "@/lib/money";
import { liveTradingAvailable } from "@/lib/polymarket/managed-account";
import { telegramConfigured } from "@/lib/telegram";

async function profile(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true, mode: true, paperCash: true, telegramChatId: true, tradingAccount: { select: { liveEnabled: true, paused: true } } },
  });
  return {
    id: user.id, name: user.name, email: user.email, image: user.image, mode: user.mode,
    paperCashUsd: num(user.paperCash),
    live: {
      available: liveTradingAvailable(),
      account: Boolean(user.tradingAccount),
      enabled: user.tradingAccount?.liveEnabled ?? false,
      paused: user.tradingAccount?.paused ?? false,
    },
    telegram: { configured: telegramConfigured(), linked: Boolean(user.telegramChatId) },
  };
}

export async function GET() {
  try {
    return json(await profile(await requireUserId()));
  } catch (error) {
    return fail(error);
  }
}

const patch = z.object({ mode: z.enum(["PAPER", "LIVE"]) }).strict();

export async function PATCH(req: Request) {
  try {
    const userId = await requireUserId();
    const parsed = patch.safeParse(await readJson(req));
    if (!parsed.success) return json({ error: "Choose Practice or Live." }, 400);
    await prisma.user.update({ where: { id: userId }, data: { mode: parsed.data.mode } });
    return json(await profile(userId));
  } catch (error) {
    return fail(error);
  }
}
