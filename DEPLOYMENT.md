# Deploying Zircon

The app is `my-app/` (Next.js on Vercel). Every variable is documented in
[`my-app/.env.example`](my-app/.env.example).

## 1. Database

Postgres (Supabase works). Apply the schema once per database:

```bash
cd my-app && yarn db:migrate
```

## 2. Vercel environment

Required for the app: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, `CRON_SECRET`.

- `APP_URL` must be the **final** domain, e.g. `https://www.zirconlabs.org`.
  TradingView won't follow a redirect, so an apex domain that redirects to
  `www` would break every webhook.
- Google OAuth needs `<AUTH_URL>/api/auth/callback/google` as a redirect URI.

`/api/health` lists anything missing (names only, never values).

## 3. Run the automation engine (required)

Automations only protect anyone if something runs the engine. Pick one:

| Option | Reaction time | Cost |
| --- | --- | --- |
| **Always-on worker** — `yarn worker` on Railway, Fly, Render or any VM with the same env | ~5 seconds | small VM |
| **Free scheduler** — cron-job.org (or similar) calling `GET https://<APP_URL>/api/cron/tick` every minute with header `Authorization: Bearer <CRON_SECRET>` | ~1 minute | free |
| **Vercel Cron** (Pro plan) — add `{"crons":[{"path":"/api/cron/tick","schedule":"* * * * *"}]}` to `my-app/vercel.json`; Vercel sends the secret automatically | ~1 minute | Vercel Pro |

Running more than one is safe: automations are leased and orders are
idempotent. The app shows a warning on Portfolio and Automations whenever the
engine hasn't run for 3 minutes.

## 4. Live trading (optional)

1. `PRIVY_APP_ID`, `PRIVY_APP_SECRET` — Privy server wallets.
2. `POLYMARKET_BUILDER_KEY/SECRET/PASSPHRASE` — mint with
   `node --import tsx --env-file=.env scripts/mint-builder-key.ts`.
3. In the Privy dashboard, add a wallet policy that only allows transactions to
   Polymarket's contracts and relayer, so a leaked app secret can't be used to
   send funds anywhere else.
4. Fund your own account with a small amount, place and sell a $1 order, then
   set `POLYMARKET_LIVE_ENABLED=true`. Each user still turns live on for their
   own account.

## 5. Telegram alerts (optional)

Create a bot with @BotFather, set `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, deploy, then run once:

```bash
cd my-app && yarn telegram:setup
```
