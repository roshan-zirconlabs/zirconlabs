# Zircon

**Stop-loss, take-profit and automation for Polymarket.**

Polymarket's order book only has market and limit orders. Zircon adds the
risk tools traders expect everywhere else, and watches the market for you:

- **Protect a position** — take-profit, stop-loss, trailing stop, and "sell N
  hours before the market closes", on any Polymarket market.
- **Buy at your price** — buy when a price drops to (or rises to) your level,
  and attach protection to the new position automatically.
- **TradingView alerts** — a per-market webhook: `buy` alerts buy, `sell`/`close`
  alerts sell. Size and price limits come from your saved settings, never the alert.
- **Practice first** — $1,000 of practice money that fills against the real
  order book with each market's real taker fee, and settles like the real thing.
- **Live with guard rails** — a gasless Polymarket trading wallet per user,
  deposits from any major chain, a daily spend limit, a kill switch, automatic
  claiming of winnings, and Telegram alerts.

## How it works

```
 Browser ──► Next.js app (my-app) ──► Postgres
                 │   ▲
                 │   └── automation engine: yarn worker (every 5s)
                 │                        or GET /api/cron/tick (every minute)
                 ▼
   Polymarket — Gamma (markets), CLOB (books, orders), Data API (positions),
                Bridge (deposits), relayer (gasless Deposit Wallets)
   Privy — holds each user's signing key
```

- **One order path.** Manual trades, automations and alerts all go through
  `lib/trading/execute.ts`. An order row is written, keyed by an idempotency key,
  *before* anything is sent — a retry finds the row instead of trading twice.
  Live orders are fill-and-kill with a price limit and are never retried; if we
  can't confirm one reached Polymarket it is recorded `UNKNOWN` for review.
- **Two books that never mix.** Practice positions live in our database; live
  positions are always read from Polymarket.
- **The engine** (`lib/engine/tick.ts`) prices every active automation in one
  batch, leases each one before it acts (so several engines can run at once),
  settles practice positions on resolved markets, claims live winnings,
  reconciles queued orders, and sends alerts.

See [DEPLOYMENT.md](DEPLOYMENT.md) to run it and [TODO.md](TODO.md) for what's next.
