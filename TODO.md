# Zircon — TODO

Target: Colosseum Crypto World's Fair — submit by **Oct 12, 2026, 11:59pm PT**.
Judged on functionality, impact, novelty, UX, open source, business plan. No Polygon track → general pool only.

## Done (2026-09-27)
- [x] Live orders record the real fill (spent / shares / price) instead of stake + price cap
- [x] "delayed" orders recorded as pending, not as "nothing bought"
- [x] Failed order calls marked UNKNOWN; uncertain orders stop blocking the daily budget after 24h
- [x] Realized P&L subtracts losing trades (it only counted wins before)
- [x] Track record says real vs simulated and never blends them (Luca's feedback)
- [x] Paper fills include Polymarket's taker fee (0.07 × p × (1−p) on crypto)
- [x] Default max price 95¢ → 55¢, with a plain risk explanation
- [x] Rule waits for the candle that just closed instead of using stale data
- [x] Removed rent-per-call price, x402 copy and Sepolia attestation

## Before anyone trades real money
- [ ] Confirm the live-trading flags in Vercel (both are "false" locally, which forces paper)
- [ ] Reconcile queued/unknown orders against Polymarket (no job does this yet)
- [ ] Auto-claim winnings from resolved markets (today it's a manual button per market)
- [ ] Lock down Privy server wallets (signing policy) + protect withdrawals (re-auth, allowlist)
- [ ] Terms of service + eligibility check (Polymarket geo rules; our server places the orders)
- [ ] Per-bot loss limit + auto-pause; alerts for trades, failures, low balance
- [ ] Run my own bots live at $5 stakes for 1–2 weeks

## For Colosseum
- [ ] Decide: add Kalshi-on-Solana (DFlow API) as a second venue → makes us eligible for the Solana track
- [ ] Rules backtester over real resolved markets, with fees — proves (or disproves) an edge
- [ ] Clear business model in the product (e.g. subscription for live bots)
- [ ] Beginner flow: one builder, onboarding checklist, "dry run" button, no jargon
- [ ] Pitch video + technical demo; confirm repo is public
- [ ] Real users on paper mode before the deadline (traction)

## Later
- [x] Replace KeeperHub with our own scheduler (cron tick + BotRun table + webhook endpoint)
- [x] Remove the KeeperHub catalog (the canvas stays, limited to PolyTrade blocks)
