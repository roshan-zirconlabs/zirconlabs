# Zircon — web app

Next.js 16 (App Router), Prisma 7 on Postgres, NextAuth v5 (Google).

```bash
yarn install          # also runs prisma generate
cp .env.example .env  # practice mode needs sections 1–4
yarn db:migrate
yarn dev              # app on http://localhost:3000
yarn worker           # automation engine, in a second terminal
```

| Command | Purpose |
| --- | --- |
| `yarn test` | Unit tests (`lib/**/*.test.ts`) |
| `yarn lint` / `yarn build` | ESLint / production build |
| `yarn worker` | Always-on automation engine (every 5s) |
| `yarn tick` | Run one engine pass and print what it did |
| `yarn telegram:setup` | Point the Telegram bot at this deployment |

Layout:

- `app/` — pages (`dashboard`, `markets`, `automations`, `account`) and API routes
- `lib/trading/execute.ts` — the single order path (practice and live)
- `lib/automations/` — automation settings (`config.ts`) and trigger rules (`evaluate.ts`)
- `lib/engine/tick.ts` — the automation engine
- `lib/polymarket/` — market data, prices, positions, Deposit Wallet client, withdrawals
- `lib/paper-fill.ts` — practice fills against the real book with real fees

See [DEPLOYMENT.md](../DEPLOYMENT.md) for production setup.
