import crypto from "crypto";

/**
 * Secret for a bot's public alert URL. TradingView cannot send headers, so
 * the secret travels in the path. It is derived from the server secret, so
 * one URL authorises exactly one bot and nothing is stored per bot.
 */

/** BOT_SECRET; ZLABS_INGEST_SECRET is read for deployments set up before the rename. */
export function botSecretValue(env: Record<string, string | undefined> = process.env): string {
  return (env.BOT_SECRET ?? env.ZLABS_INGEST_SECRET ?? "").trim();
}

function secret(): Buffer {
  const value = botSecretValue();
  if (value.length < 24) {
    throw new Error("BOT_SECRET must be set to at least 24 characters before bots can receive alerts.");
  }
  return Buffer.from(value, "utf8");
}

export function botHookToken(botId: string): string {
  if (!/^[a-z0-9]{1,64}$/i.test(botId)) throw new Error("Invalid bot identifier.");
  return crypto.createHmac("sha256", secret()).update(`zh1:${botId}`).digest("hex").slice(0, 40);
}

export function verifyBotHookToken(botId: string, token: string | null | undefined): boolean {
  if (typeof token !== "string" || !/^[a-f0-9]{40}$/.test(token)) return false;
  let expected: string;
  try { expected = botHookToken(botId); } catch { return false; }
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
