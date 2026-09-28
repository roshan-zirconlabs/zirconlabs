/**
 * Alerts over Telegram. Optional: everything works without it, and alerts are
 * always in the in-app activity feed.
 *
 * Setup: create a bot with @BotFather, then set TELEGRAM_BOT_TOKEN,
 * TELEGRAM_BOT_USERNAME and TELEGRAM_WEBHOOK_SECRET, and run
 * `yarn telegram:setup` once to point the bot at /api/telegram/webhook.
 */

export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_BOT_USERNAME?.trim());
}

export async function telegram(method: string, body: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!res.ok || !json?.ok) throw new Error(`Telegram ${method} failed: ${json?.description ?? res.status}`);
  return json;
}

export function sendTelegram(chatId: string, text: string) {
  return telegram("sendMessage", { chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true });
}
