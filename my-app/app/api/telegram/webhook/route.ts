import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendTelegram } from "@/lib/telegram";

/**
 * Telegram → us. Only accepts calls carrying the secret we registered with
 * setWebhook. Handles /start <code> (link) and /stop (unlink).
 */
export async function POST(req: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!expected || got.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const update = (await req.json().catch(() => null)) as { message?: { chat?: { id?: number }; text?: string } } | null;
  const chatId = update?.message?.chat?.id;
  const text = update?.message?.text?.trim() ?? "";
  if (!chatId) return NextResponse.json({ ok: true });

  try {
    const code = /^\/start\s+([a-f0-9]{24})$/.exec(text)?.[1];
    if (code) {
      const user = await prisma.user.findFirst({ where: { telegramLinkCode: code, telegramLinkExpires: { gt: new Date() } } });
      if (!user) {
        await sendTelegram(String(chatId), "That link has expired. Open Zircon → Account → Connect Telegram to get a new one.");
      } else {
        // A chat belongs to one account: unlink it anywhere else first.
        await prisma.user.updateMany({ where: { telegramChatId: String(chatId), NOT: { id: user.id } }, data: { telegramChatId: null } });
        await prisma.user.update({ where: { id: user.id }, data: { telegramChatId: String(chatId), telegramLinkCode: null, telegramLinkExpires: null } });
        await sendTelegram(String(chatId), "✅ Connected. You'll get a message here whenever an automation trades, fails, or needs you. Send /stop to disconnect.");
      }
    } else if (text === "/stop") {
      await prisma.user.updateMany({ where: { telegramChatId: String(chatId) }, data: { telegramChatId: null } });
      await sendTelegram(String(chatId), "Disconnected. You won't get alerts here anymore.");
    }
  } catch (error) {
    console.error("[telegram] webhook error", error);
  }
  return NextResponse.json({ ok: true });
}
