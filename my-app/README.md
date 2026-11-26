# PolyTrade — web application

The deployable PolyTrade app (polytrade.fi): Next.js 16 (App Router), Prisma 7
on Postgres, NextAuth v5 with Google, Privy-held trading wallets, and the
PolyTrade runner for bot execution.

```bash
yarn install          # also runs prisma generate
cp .env.example .env  # fill in; every variable is documented inline
yarn db:migrate
yarn dev
```

| Command | Purpose |
| --- | --- |
| `yarn test` | Unit tests (`lib/**/*.test.ts`) |
| `yarn lint` | ESLint |
| `yarn build` | Production build |
| `yarn worker` | Run the bot runner in a loop (alternative to calling `/api/runner/tick`) |
| `yarn check:deployment` | Validate environment and database, same checks as `/api/health` |

Layout:

- `app/` — pages and API routes
  - `api/runner/tick` — one runner tick: evaluates every scheduled bot whose market window is due
  - `api/hooks/[botId]/[token]` — a bot's TradingView alert URL
- `lib/runner/` — the runner: decision (`decide.ts`), order execution with all live checks (`execute.ts`), scheduling and run log (`run.ts`)
- `lib/polymarket/` — Deposit Wallet client, region check, cash-out, spend reservation
- `lib/workflow/` — strategy spec, active-market resolution, candles, alert-URL secrets
- `components/workflow` — the visual editor (PolyTrade blocks only)
- `scripts/mint-builder-key.ts` — one-time Polymarket builder key for live trading
- `scripts/supabase-runner-cron.sql` — schedules the runner every minute from Supabase (free)

## How a bot runs

A bot is one trigger, one rule and one order, with a stake, a price cap and a
practice/real-money switch. Scheduled bots are evaluated once per market window
(the runner claims each window in the database, so overlapping ticks never trade
twice). Alert bots trade when their TradingView alert arrives; repeat alerts in
the same window are ignored. Every live order re-checks the account, balance,
approvals and this server's Polymarket region first, and is never retried.

## Deploying

See [DEPLOYMENT.md](../DEPLOYMENT.md): Vercel (functions pinned to Dublin),
Supabase, and `scripts/supabase-runner-cron.sql` to call the runner every
minute — all on free plans.
