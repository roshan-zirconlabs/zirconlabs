# Zircon Labs

Zircon Labs lets anyone build an automated Polymarket strategy without touching
a wallet, a private key, or a workflow engine. You describe the strategy in
plain language; Zircon compiles it into a real KeeperHub workflow, runs it on a
schedule, and shows you every execution.

## How it actually works

```text
Browser → Zircon (Next.js) → Supabase Postgres
                │
                ├── compiles your strategy into a KeeperHub workflow
                │   (Schedule → HTTP Request → Condition → HTTP Request)
                │
                └── KeeperHub runs it on schedule and calls back:
                      POST /api/workflow/signal   → which market, which direction
                      POST /api/workflow/execute  → place the order
                                │
                                └── Polymarket CLOB, signed by the
                                    user's own Privy-held wallet
```

Two properties follow from this shape, and both are deliberate:

- **KeeperHub orchestrates; it never holds your money.** The workflow contains
  no keys and no funds. It calls Zircon, and Zircon signs with the wallet
  belonging to that bot's owner.
- **Every callback is scoped to one bot.** Each published workflow carries a
  token derived from the server secret that authorises exactly one bot. A leaked
  token cannot touch another user's wallet or trades.

## What is real, and what is not

- Backtests and practice ("paper") trades are research data. A practice fill is
  priced against the live order book but no order is sent and no money moves.
- Every workflow execution is a real KeeperHub run with a real run record.
  Zircon does not simulate the engine or invent transaction hashes.
- Real-money trades are placed through Polymarket's official TypeScript SDK from
  a wallet provisioned per user. Zircon stores the wallet id and public address;
  the provider holds the key. Zircon cannot withdraw your funds.
- Real-money trading stays off until `POLYMARKET_CLOB_V2_ADAPTER_READY` and
  `POLYMARKET_LIVE_ENABLED` are both `true`, the user's account is funded and
  approved, and the user turns it on for their own account.

## Guardrails on a live bot

- A per-window request id: one order per bot per market window, so a repeated
  schedule tick cannot double-spend.
- The order step never auto-retries.
- The strategy is re-evaluated server-side before the order; if the market
  rotated or the rule changed its mind, nothing is executed.
- A per-user daily spend limit, reserved under an advisory lock before signing.
- A per-share price cap, and a check against the market's minimum order size.

## Local development

```bash
cd my-app
yarn install
cp .env.example .env     # then fill it in — see the comments in that file
yarn prisma generate
yarn db:migrate
yarn dev
```

`AUTH_URL` must match the origin you actually browse to, or Google sign-in will
fail and `/api/health` will report `AUTH_ORIGIN_MISMATCH`. For local work that
means `http://localhost:3000`, not your production domain.

Before deploying:

```bash
yarn tsc --noEmit && yarn lint && yarn test && yarn build
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for production setup and the live-trading
enablement checklist.
