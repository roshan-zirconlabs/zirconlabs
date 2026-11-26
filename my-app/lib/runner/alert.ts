/**
 * Reads the direction out of whatever an alert sends. TradingView posts the
 * alert message verbatim: plain text ("buy"), or JSON a user wrote, commonly
 * {"action": "{{strategy.order.action}}"}.
 */
export function alertActionFrom(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    for (const key of ["action", "side", "direction", "signal"]) {
      if (typeof body[key] === "string") return (body[key] as string).trim();
    }
    const order = (body.strategy as { order?: { action?: unknown } } | undefined)?.order?.action;
    if (typeof order === "string") return order.trim();
    return null;
  } catch {
    // Plain-text alert: the first word names the direction.
    return text.split(/\s+/)[0].slice(0, 40);
  }
}
