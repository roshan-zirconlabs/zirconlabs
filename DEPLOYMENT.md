# PolyTrade — Deployment Guide

## 1. What you are deploying

One Next.js application (polytrade.fi) and a once-a-minute call to its runner.
Everything below runs on free plans.

```text
Vercel Hobby (Next.js, functions in dub1)  →  Supabase Postgres (free)
        │
        ├─→ /api/runner/tick   called every minute by Supabase pg_cron
        ├─→ /api/hooks/...     TradingView alerts, one secret URL per bot
        ├─→ Polymarket Gamma + CLOB   markets, order books, orders, resolution
        ├─→ Binance → Coinbase → Bitstamp   candles (first that answers wins)
        └─→ Privy               one trading wallet per user (free up to 499 users)
```

**Region matters.** Polymarket decides whether an API order may open a position
from the IP that sends it. US, UK, German, French, Singaporean and Australian
servers (among others) are close-only. `my-app/vercel.json` pins functions to
Dublin (`dub1`); `/api/health` shows the region Polymarket sees.

**Vercel Hobby is for non-commercial use.** It is fine while PolyTrade is
free. Before charging users, move to Vercel Pro or to another host (Google
Cloud Run's free tier in `europe-west4`, or `yarn worker` plus `next start` on
an Oracle Cloud Always Free VM in an allowed region).

## 2. How a bot runs

`lib/runner/` does everything in-process:

1. **Schedule bots.** Each tick finds bots whose market window is due, claims
   the window in the database (so overlapping ticks never trade twice),
   evaluates the rule on closed candles, and executes.
2. **Alert bots.** A TradingView alert posts to the bot's URL; the direction
   comes from the alert, the market and per-window request id are resolved
   server-side.
3. **Execute.** A practice fill at the live order book, or a signed order from
   the owner's Deposit Wallet after re-checking account, balance, approvals and
   this server's region. Orders are never retried; an uncertain one stays
   `UNKNOWN`.

Every evaluation is written to the bot's run log (`BotRun`).

## 3. Environment

`my-app/.env.example` documents every variable. The ones that most often go
wrong:

| Variable | Why it matters |
| --- | --- |
| `AUTH_URL` | Must equal the origin the browser lands on **after redirects**, or Google sign-in breaks. |
| `APP_URL` | Public HTTPS origin (`https://polytrade.fi`). Alert URLs are built from it. |
| `BOT_SECRET` | Derives every bot's alert URL (24+ characters). Rotating it changes every alert URL. |
| `CRON_SECRET` | Bearer secret for `/api/runner/tick`. Without a scheduler calling it, scheduled bots never run. |
| `DATABASE_URL` | On Vercel use Supabase's shared transaction pooler URL (port 6543). |

Register `<AUTH_URL>/api/auth/callback/google` in Google Cloud for every domain
you serve.

## 4. First deploy

```bash
cd my-app
yarn db:migrate                     # against the production DATABASE_URL
```

Then in Supabase → SQL Editor, run `my-app/scripts/supabase-runner-cron.sql`
with your `APP_URL` and `CRON_SECRET` filled in. It calls the runner every
minute, and each tick's heartbeat write keeps the free project from pausing.

Add a free uptime monitor (UptimeRobot or Better Stack) on
`https://polytrade.fi/api/health`: it reports `RUNNER_STALE` when the scheduler
stops and `unavailable` when the database is down.

## 5. Verification before launch

```bash
cd my-app
yarn tsc --noEmit && yarn lint && yarn test && yarn build
curl -s https://polytrade.fi/api/health
```

Then: sign in, create a bot, save a practice strategy, turn it on, and confirm a
run appears on the bot page within one window. For an alert bot, send
`curl -X POST <alert URL> -d buy` and confirm a practice trade.

## 6. Enabling real-money trading

Practice mode needs none of this.

1. Set `PRIVY_APP_ID` and `PRIVY_APP_SECRET`.
2. Mint a builder key and set `POLYMARKET_BUILDER_KEY`, `_SECRET` and
   `_PASSPHRASE`:
   ```bash
   cd my-app && npx tsx --env-file=.env scripts/mint-builder-key.ts
   ```
   The builder key authorizes gasless creation of each user's Deposit Wallet
   through Polymarket's relayer. No token approvals or POL are needed.
3. Confirm `/api/health` shows an allowed `region`, then set
   `POLYMARKET_LIVE_ENABLED="true"` and redeploy.
4. Each user opens `/wallet`, creates their trading account, funds it through
   the deposit address shown there, sets a daily limit, and turns on live
   trading.
5. Switch one bot to live with the smallest stake and confirm the order and the
   Polymarket position before trusting it with more.

### Safety properties to preserve

- One order per bot per market window, via a deterministic request id.
- The order step never auto-retries.
- Daily spend is reserved under a Postgres advisory lock *before* signing.
- An uncertain submission stays `UNKNOWN`, holds its reservation, and is never
  reported as success.
