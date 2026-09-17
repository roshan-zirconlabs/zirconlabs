# Zircon Labs — web application

The deployable Zircon Labs app: Next.js 16 (App Router), Prisma 7 on Postgres,
NextAuth v5 with Google, and hosted KeeperHub for workflow execution.

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
| `yarn check:deployment` | Validate environment and database, same checks as `/api/health` |

Layout:

- `app/` — pages and API routes (`api/workflow/*` are KeeperHub callbacks)
- `components/` — UI, including the visual workflow editor in `components/workflow`
- `lib/workflow/` — strategy spec, workflow compiler, candles, callback tokens
- `lib/polymarket/` — Deposit Wallet client, cash-out, spend reservation
- `lib/track-record.ts`, `lib/attestation.ts` — public verifiable track records
- `scripts/mint-builder-key.ts` — one-time Polymarket builder key for live trading

See the root [README](../README.md) for how the system works and
[DEPLOYMENT.md](../DEPLOYMENT.md) for production setup.
