# Zircon Labs

Zircon Labs turns a trading signal into a guarded, traceable Polymarket bot, with
KeeperHub as the execution layer. Pick a rule — or point a TradingView alert at
your bot — and Zircon compiles it into a real KeeperHub workflow that trades the
live BTC/ETH up-or-down markets every window. Nobody handles a private key, a
gas token or a workflow engine.

Live at [zirconlabs.org](https://www.zirconlabs.org).

## How it works

```text
Browser → Zircon (Next.js on Vercel) → Postgres (Supabase)
             │
             ├── compiles each bot into a KeeperHub workflow
             │     schedule:  Schedule → [check balance] → HTTP signal → Condition → HTTP execute
             │     webhook:   TradingView alert → [check balance] → HTTP execute
             │
             └── KeeperHub runs it and calls back, per bot:
                   POST /api/workflow/signal    which market is open, which direction
                   POST /api/workflow/execute   practice fill, or a signed live order
                                │
                                └── Polymarket CLOB, from the owner's own
                                    Deposit Wallet (Privy key, gasless relayer)
```

- **KeeperHub orchestrates; it never holds user money.** Workflows carry no keys.
  Live bots verify collateral on-chain through KeeperHub's
  `web3/check-token-balance` before any order.
- **Every callback is scoped to one bot.** Each workflow carries a token derived
  from the server secret that authorises exactly that bot.
- **The market is resolved server-side.** A TradingView alert supplies only a
  direction; Zircon picks the open market and the per-window request id, so a
  leaked webhook URL can at most place one capped order per window.

## Verifiable track records

A bot owner can publish a strategy once at least one of its trades has
resolved. Published strategies appear at `/strategies`, and each has a public
record at:

```text
GET /api/strategies/{workflowId}/track-record
```

The record is computed only from **KeeperHub execution records** and
**Polymarket's on-chain resolution** — never from Zircon's database — and every
settled trade carries its KeeperHub execution id and on-chain `conditionId`, so
anyone (or any agent) can recompute it. Open positions are withheld; the live
signal is what a subscription buys. Publishing also anchors the strategy with a
transaction executed through KeeperHub (Ethereum Sepolia), linked on the page.

## Guardrails on a live bot

- One order per bot per market window, enforced by a deterministic request id.
- The order step never auto-retries; an uncertain submission stays `UNKNOWN`.
- The rule is re-evaluated server-side before ordering; if the market rotated
  or the signal changed, nothing executes.
- A per-user daily spend limit, reserved under a Postgres advisory lock before
  signing, plus a per-share price cap and the market's minimum order size.
- Real money stays off until the operator enables it **and** the user turns it
  on for their own account.

## Repository

| Path | What it is |
| --- | --- |
| `my-app/` | The Next.js application — UI, API routes, workflow compiler, Prisma schema |
| `my-app/lib/workflow/` | Strategy spec, workflow compiler, candle providers, callback tokens |
| `my-app/lib/track-record.ts` | Verifiable track-record engine |
| `my-app/lib/polymarket/` | Deposit Wallet client, cash-out, spend reservation |
| `DEPLOYMENT.md` | Production setup and the live-trading checklist |

The KeeperHub-side Polymarket plugin (market status, live odds, market
resolution, signal evaluation, paper orders) lives on
[`roshan-zirconlabs/keeperhub`](https://github.com/roshan-zirconlabs/keeperhub/tree/feat/polymarket-verifiable-resolution).

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
`AUTH_ORIGIN_MISMATCH`. Scheduled bots need a public `ZLABS_PUBLIC_URL`;
KeeperHub cannot call back to `localhost`.

Before shipping:

```bash
yarn tsc --noEmit && yarn lint && yarn test && yarn build
```
