/**
 * Points the Telegram bot at this deployment. Run once after setting
 * TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and APP_URL:
 *
 *   yarn telegram:setup
 */
import { telegram } from "../lib/telegram";

async function main() {
  const app = (process.env.APP_URL || process.env.AUTH_URL || "").replace(/\/$/, "");
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (!app.startsWith("https://")) throw new Error("Set APP_URL to the public https:// origin.");
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(secret)) throw new Error("Set TELEGRAM_WEBHOOK_SECRET (16+ letters, digits, _ or -).");
  await telegram("setWebhook", { url: `${app}/api/telegram/webhook`, secret_token: secret, allowed_updates: ["message"] });
  console.log(`Telegram webhook set to ${app}/api/telegram/webhook`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
