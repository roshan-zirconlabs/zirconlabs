# Zircon Labs — Deployment Guide

## 1. What you are deploying

One Next.js application. There is no separate backend, no self-hosted workflow
engine, and no service to build besides this app.

```text
Vercel (Next.js)  →  Supabase Postgres
        │
        ├─→ KeeperHub hosted API      (creates, schedules and runs workflows)
        ├─→ Polymarket Gamma + CLOB   (markets, order books, orders)
        ├─→ Binance klines            (candles for strategy rules)
        └─→ Privy                     (one managed Polygon wallet per user)
```

> If you previously hit "Ran out of memory (used over 8GB)" on Render, that was
> from building a KeeperHub fork. Do not self-host KeeperHub. This app builds in
> roughly 60 seconds at about 1.1 GB peak memory.

## 2. Request flow for a running bot

1. KeeperHub's Schedule trigger fires on the strategy's cron.
2. `HTTP Request` → `POST /api/workflow/signal` — Zircon resolves the market
   that is open right now, pulls closed candles, evaluates the rule, and returns
   a decision plus a per-window request id.
3. `Condition` — continues only when the decision is tradable.
4. `HTTP Request` → `POST /api/workflow/execute` — Zircon re-evaluates the rule,
   then records a practice fill or submits a signed order from the bot owner's
   wallet.

Both callbacks authenticate with a bearer token derived from
`ZLABS_INGEST_SECRET` and the bot id. A token authorises exactly one bot.

## 3. Database

Create a Supabase (or any Postgres) project, then:

- **`DATABASE_URL`** — on Vercel, the shared **Transaction pooler** string
  (port 6543) from Supabase Connect. A direct `db.<ref>.supabase.co` host needs
  IPv6 and will fail on Vercel; `/api/health` reports this as
  `SUPABASE_DIRECT_CONNECTION`.
- **`DIRECT_URL`** — optional, for migrations over IPv4 (Session pooler, 5432).

Apply migrations on every release:

```bash
yarn db:migrate
```

This is a release step, not a build step. If it is skipped, API routes return
`SCHEMA_MIGRATION_REQUIRED` rather than failing obscurely.

## 4. Environment variables

Copy `my-app/.env.example` — it documents every variable inline. The ones that
most often go wrong:

| Variable | Why it matters |
| --- | --- |
| `AUTH_URL` | Must equal the origin the browser lands on **after redirects**. A mismatch breaks Google sign-in. Do not also set `NEXTAUTH_URL` to a different origin. |
| `ZLABS_PUBLIC_URL` | The public HTTPS origin KeeperHub calls back on. Falls back to `AUTH_URL`. Must be reachable from the internet — `localhost` will never work for a scheduled bot. |
| `ZLABS_INGEST_SECRET` | Derives every bot's callback token. Rotating it invalidates all published workflows; republish each bot afterwards. |
| `ENCRYPTION_KEY` | Exactly 64 hex characters (`openssl rand -hex 32`). |
| `KEEPERHUB_API_KEY` | The platform organization key. With it set, users never handle a KeeperHub key. |

Register `<AUTH_URL>/api/auth/callback/google` in the Google Cloud console for
both the apex and `www` domains you actually serve.

## 5. KeeperHub

Zircon compiles strategies into workflows built only from actions KeeperHub
publishes: `Schedule`, `HTTP Request` and `Condition`.

- **`HTTP Request` requires a KeeperHub Pro plan.** Without it, publishing fails
  with the catalog's own error. Verify your plan before launch.
- With `KEEPERHUB_API_KEY` set, all users' workflows live in that one
  organization. Workflow names carry `zircon:<botId>` so every run is
  attributable. The organization's wallet is **not** used for trading — orders
  are signed by each user's own wallet.
- A user who prefers their own environment can connect a `kh_` key under
  `/connections`; it takes precedence over the platform key for that user.

Verify the catalog is reachable from your deployment:

```bash
curl -s https://<your-domain>/api/keeperhub/catalog | head -c 200
```

## 6. Verification before launch

```bash
cd my-app
yarn tsc --noEmit
yarn lint
yarn test
yarn build
```

Then, against the deployed domain:

```bash
curl -s https://<your-domain>/api/health
```

`status: "ok"` means required variables are present, the auth origin matches,
and the database answers with the expected schema. Anything else names the
specific problem and its fix.

Finally, sign in, create a bot, save a practice strategy, press **What would it
do right now?**, then **Publish & activate**. A run should appear in KeeperHub
within one schedule window.

## 7. Enabling real-money trading

Practice mode needs none of this. Turn on real money only after every step
below passes.

1. Set `PRIVY_APP_ID` and `PRIVY_APP_SECRET`.
2. Each user opens `/wallet` and creates their trading account (one isolated
   Polygon wallet, key held by Privy).
3. The user funds it with Polymarket collateral (pUSD) through the bridge on
   that page, **and** sends a small amount of POL for gas.
4. The user presses **Authorise trading** to grant Polymarket's exchange
   contracts the ERC-20 and ERC-1155 approvals. Without this, orders cannot
   settle — the readiness panel shows the missing count.
5. Set `POLYMARKET_CLOB_V2_ADAPTER_READY="true"` and
   `POLYMARKET_LIVE_ENABLED="true"` and redeploy.
6. The user sets a daily spend limit and turns on live trading for their
   account.
7. Place one small order through `/trade` and confirm the receipt and the
   Polymarket position before letting a bot trade live.

### Safety properties to preserve if you modify this code

- One order per bot per market window, enforced by a deterministic request id.
- The execute step must never auto-retry.
- Daily spend is reserved under a Postgres advisory lock *before* signing.
- An uncertain submission stays `UNKNOWN` and holds its reservation; it is never
  retried automatically and never reported as success.

## 8. Operational notes

- `/api/cron/fetch-markets` is a scheduled refresh; wire it to Vercel Cron if
  you want warm market data.
- There is no filesystem cache anywhere in the request path. Market data is read
  live, which is what makes the app work on serverless.
- Logs never contain wallet keys or KeeperHub keys. Connection errors are
  returned as codes, not raw upstream messages.
