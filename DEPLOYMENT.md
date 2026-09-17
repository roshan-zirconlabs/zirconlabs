# Zircon Labs — Deployment Guide

## 1. What you are deploying

One Next.js application. There is no separate backend and no self-hosted
workflow engine.

```text
Vercel (Next.js)  →  Supabase Postgres
        │
        ├─→ KeeperHub hosted API       creates, schedules and runs workflows
        ├─→ Polymarket Gamma + CLOB    markets, order books, orders, resolution
        ├─→ Binance → Coinbase → Bitstamp   candles (first that answers wins)
        └─→ Privy                      one managed wallet per user
```

Do not self-host KeeperHub. This app builds in about a minute on Vercel.

## 2. Request flow for a running bot

1. The workflow trigger fires — a `Schedule` on the strategy's cadence, or a
   `Webhook` hit by a TradingView alert.
2. Live bots only: `web3/check-token-balance` confirms collateral on-chain.
3. Schedule bots: `HTTP Request` → `POST /api/workflow/signal` resolves the open
   market, evaluates the rule on closed candles, and returns a decision plus a
   per-window request id. A `Condition` continues only when it is tradable.
4. `HTTP Request` → `POST /api/workflow/execute` re-evaluates, then records a
   practice fill or submits a signed order from the owner's Deposit Wallet.

Both callbacks authenticate with a bearer token derived from
`ZLABS_INGEST_SECRET` and the bot id. A token authorises exactly one bot.

## 3. Database

- **`DATABASE_URL`** — on Vercel, the Supabase **Transaction pooler** string
  (port 6543). A direct `db.<ref>.supabase.co` host needs IPv6 and fails on
  Vercel; `/api/health` reports it as `SUPABASE_DIRECT_CONNECTION`.
- **`DIRECT_URL`** — optional, for migrations over IPv4 (Session pooler, 5432).

Apply migrations on every release (a release step, not a build step):

```bash
cd my-app && yarn db:migrate
```

If skipped, API routes return `SCHEMA_MIGRATION_REQUIRED`.

## 4. Environment variables

`my-app/.env.example` documents every variable. The ones that most often go
wrong:

| Variable | Why it matters |
| --- | --- |
| `AUTH_URL` | Must equal the origin the browser lands on **after redirects**, or Google sign-in breaks. Do not also set `NEXTAUTH_URL` to a different origin. |
| `ZLABS_PUBLIC_URL` | Public HTTPS origin KeeperHub calls back on (falls back to `AUTH_URL`). `localhost` never works for a scheduled bot. |
| `ZLABS_INGEST_SECRET` | Derives every bot's callback token. Rotating it invalidates all published workflows — republish each bot. |
| `ENCRYPTION_KEY` | Exactly 64 hex characters (`openssl rand -hex 32`). |
| `KEEPERHUB_API_KEY` | Platform organization key. With it set, users never handle a KeeperHub key. |

Register `<AUTH_URL>/api/auth/callback/google` in Google Cloud for every domain
you serve (apex and `www`).

## 5. KeeperHub

Workflows are built only from actions KeeperHub publishes: `Schedule`,
`Webhook`, `HTTP Request`, `Condition` and `web3/check-token-balance`.

- **`HTTP Request` requires a KeeperHub Pro plan.** Without it, publishing fails
  with the catalog's own error.
- All platform users' workflows live in the `KEEPERHUB_API_KEY` organization,
  named `… · zircon:<botId>` so every run is attributable. A user can connect
  their own `kh_` key under `/connections`; it takes precedence for them.
- The organization's Turnkey wallet signs the **publication attestation** for
  listed strategies — a 0-value transaction on Ethereum Sepolia. Keep a little
  Sepolia ETH in it; without gas, publishing still works but no on-chain link is
  recorded. It is never used for trading.

Check the catalog from your deployment:

```bash
curl -s https://<your-domain>/api/keeperhub/catalog | head -c 200
```

## 6. Verification before launch

```bash
cd my-app
yarn tsc --noEmit && yarn lint && yarn test && yarn build
curl -s https://<your-domain>/api/health
```

`"status": "healthy"` means required variables are present, the auth origin
matches, and the database answers with the expected schema. Anything else
names the problem.

Then: sign in, create a bot, save a practice strategy, turn it on, and confirm a
run appears on the bot page within one window.

## 7. Enabling real-money trading

Practice mode needs none of this.

1. Set `PRIVY_APP_ID` and `PRIVY_APP_SECRET`.
2. Mint a builder key and set `POLYMARKET_BUILDER_KEY`, `_SECRET` and
   `_PASSPHRASE`:
   ```bash
   cd my-app && npx tsx --env-file=.env scripts/mint-builder-key.ts
   ```
   Polymarket rejects plain-wallet makers; the builder key authorizes gasless
   creation of each user's Deposit Wallet through Polymarket's relayer. No
   token approvals or POL are needed.
3. Set `POLYMARKET_CLOB_V2_ADAPTER_READY="true"` and
   `POLYMARKET_LIVE_ENABLED="true"`, then redeploy.
4. Each user opens `/wallet`, creates their trading account, funds it through
   the deposit address shown there, sets a daily limit, and turns on live
   trading.
5. Switch one bot to live with the smallest stake and confirm the order and the
   Polymarket position before trusting it with more.

### Safety properties to preserve

- One order per bot per market window, via a deterministic request id.
- The execute step never auto-retries.
- Daily spend is reserved under a Postgres advisory lock *before* signing.
- An uncertain submission stays `UNKNOWN`, holds its reservation, and is never
  reported as success.

## 8. Operational notes

- Market data is read live; there is no filesystem cache in any request path.
- `yarn check:deployment` runs the same configuration checks as `/api/health`
  from your terminal.
- Logs never contain wallet or KeeperHub keys; upstream errors are returned as
  codes.
- Billing (`/billing`) is optional and reports "not configured" without Stripe
  variables.
