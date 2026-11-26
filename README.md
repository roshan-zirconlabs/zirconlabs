# PolyTrade

PolyTrade turns a trading signal into a guarded Polymarket bot. Pick a rule, or
point a TradingView alert at your bot, and it trades the live BTC/ETH
up-or-down markets every window, from your own trading wallet, within the
stake and price limits you set. Practice mode records what each trade would
have cost at the real order book before any money moves.

Live at [polytrade.fi](https://polytrade.fi).

## How it works

```text
Browser → PolyTrade (Next.js on Vercel, Dublin) → Postgres (Supabase)
             │
             └── PolyTrade runner
                   schedule:  /api/runner/tick every minute (Supabase pg_cron)
                              → each due bot, once per window
                   alerts:    TradingView → /api/hooks/{bot}/{secret} → that bot

                 decide:  which market is open, which direction (lib/runner/decide.ts)
                 execute: practice fill, or a signed live order (lib/runner/execute.ts)
                              │
                              └── Polymarket CLOB, from the owner's own Deposit
                                  Wallet (Privy-held key, gasless relayer)
```

- **The market is resolved server-side.** An alert supplies only a direction;
  PolyTrade picks the open market and the per-window request id, so a leaked
  alert URL can at most place one capped order per window.
- **Charts.** Each bot shows TradingView's chart for its asset and timeframe,
  so traders can check it against their own indicators.

## Guardrails on a live bot

- One order per bot per market window, enforced by a deterministic request id
  and a database claim on each window.
- The order step never auto-retries; an uncertain submission stays `UNKNOWN`.
- The rule is re-evaluated before ordering; if the market rotated or the
  signal changed, nothing executes.
- A per-user daily spend limit, reserved under a Postgres advisory lock before
  signing, plus a per-share price cap and the market's minimum order size.
- The server checks its own Polymarket region before every live buy.
- Real money stays off until the operator enables it **and** the user turns it
  on for their own account.

## Verifiable track records

A bot owner can publish a strategy once at least one of its trades has
resolved. Published strategies appear at `/strategies`, and each has a public
record at `GET /api/strategies/{id}/track-record`, scored from the bot's run
log against Polymarket's on-chain resolution. Every record says whether it
comes from real orders or practice fills; the two are never blended.

## Repository

| Path | What it is |
| --- | --- |
| `my-app/` | The Next.js application. See [my-app/README.md](my-app/README.md) for layout |
| `DEPLOYMENT.md` | Production setup on free plans, and the live-trading checklist |
| `my-app/lib/runner/` | The bot runner |
| `my-app/lib/polymarket/` | Deposit Wallet client, region check, cash-out, spend reservation |
| `my-app/lib/workflow/` | Strategy spec, active-market resolution, candles, alert-URL secrets |

## Local development

Requires Node 24+ and Yarn 1.

```bash
cd my-app
yarn install
cp .env.example .env     # fill it in — every variable is documented inline
yarn db:migrate
yarn dev
```

`AUTH_URL` must match the origin you browse to (`http://localhost:3000`
locally), or Google sign-in fails and `/api/health` reports
`AUTH_ORIGIN_MISMATCH`.

Before shipping:

```bash
yarn tsc --noEmit && yarn lint && yarn test && yarn build
```
