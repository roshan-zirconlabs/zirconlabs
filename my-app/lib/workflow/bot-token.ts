import crypto from "crypto";

/**
 * Per-bot callback credentials.
 *
 * KeeperHub workflows call back into Zircon to read a signal and to execute an
 * order. Those requests carry no user session, so each bot gets its own bearer
 * token derived from the server secret. A token authorises exactly one bot:
 * holding one cannot move another user's funds or write another user's trades.
 */

const VERSION = "zb1";

function secret(): Buffer {
  const value = process.env.ZLABS_INGEST_SECRET?.trim();
  if (!value || value.length < 24) {
    throw new Error("ZLABS_INGEST_SECRET must be set to at least 24 characters before workflows can call back.");
  }
  return Buffer.from(value, "utf8");
}

export function botCallbackToken(botId: string): string {
  if (!/^[a-z0-9]{1,64}$/i.test(botId)) throw new Error("Invalid bot identifier.");
  const digest = crypto.createHmac("sha256", secret()).update(`${VERSION}:${botId}`).digest("hex");
  return `${VERSION}_${botId}_${digest}`;
}

/** Returns the bot id the token authorises, or null. Comparison is constant-time. */
export function verifyBotCallbackToken(token: string | null | undefined): string | null {
  if (typeof token !== "string") return null;
  // The digest is hex, so a three-way split is unambiguous.
  const parts = token.split("_");
  if (parts.length !== 3 || parts[0] !== VERSION || !/^[a-f0-9]{64}$/.test(parts[2])) return null;
  const botId = parts[1];
  if (!/^[a-z0-9]{1,64}$/i.test(botId)) return null;
  let expected: string;
  try { expected = botCallbackToken(botId); } catch { return null; }
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return botId;
}

export function bearerBotId(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  if (!/^bearer /i.test(header)) return null;
  return verifyBotCallbackToken(header.slice(7).trim());
}
