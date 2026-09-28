import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { fail, json, requireUserId, HttpError } from "@/lib/api";
import { telegramConfigured } from "@/lib/telegram";

/** Starts linking: returns a t.me link carrying a one-time code, valid 15 minutes. */
export async function POST() {
  try {
    const userId = await requireUserId();
    if (!telegramConfigured()) throw new HttpError("Telegram alerts aren't set up on this deployment.", 503);
    const code = crypto.randomBytes(12).toString("hex");
    await prisma.user.update({ where: { id: userId }, data: { telegramLinkCode: code, telegramLinkExpires: new Date(Date.now() + 15 * 60_000) } });
    return json({ url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME!.replace(/^@/, "")}?start=${code}` });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE() {
  try {
    const userId = await requireUserId();
    await prisma.user.update({ where: { id: userId }, data: { telegramChatId: null, telegramLinkCode: null, telegramLinkExpires: null } });
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
