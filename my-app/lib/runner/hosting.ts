import { botHookToken } from "@/lib/workflow/bot-token";

/** This deployment's public origin, for URLs handed to TradingView. */
export function publicOrigin(fallback?: string): string | null {
  const raw = process.env.APP_URL?.trim() || fallback;
  if (!raw) return null;
  try { return new URL(raw).origin; } catch { return null; }
}

/** The URL a TradingView alert posts to for an alert-driven bot. */
export function alertUrl(botId: string, fallbackOrigin?: string): string | null {
  const origin = publicOrigin(fallbackOrigin);
  if (!origin) return null;
  try {
    return `${origin}/api/hooks/${botId}/${botHookToken(botId)}`;
  } catch {
    // BOT_SECRET is not set: /api/health reports it as missing.
    return null;
  }
}
