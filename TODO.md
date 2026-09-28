# Zircon — TODO

## Done (2026-09-29): rebuilt as Polymarket automation
- [x] Removed KeeperHub, bots, canvas, strategy feed, billing, backtests; fresh schema
- [x] Practice mode: $1,000, real order book, each market's real taker fee, settlement on resolution
- [x] Buy with take-profit / stop-loss attached; protect or sell any position
- [x] Automations: take-profit, stop-loss, trailing stop, time exit, buy-at-price, TradingView webhooks
- [x] Engine: worker (5s) + cron route; leased automations; idempotent orders; auto-claim; queued-order reconciliation
- [x] Live: Privy wallet, deposit from any chain, daily limit, kill switch, withdrawals
- [x] Telegram alerts, activity log, engine-down warning in the UI
- [x] Verified end to end in practice mode (buy, protect, auto take-profit, entry, webhooks)

## Before you open it to users
- [ ] Set up an engine runner in production (see DEPLOYMENT.md §3) — without it automations don't run
- [ ] Set `APP_URL` and `CRON_SECRET` in Vercel
- [ ] Privy wallet policy: only Polymarket contracts/relayer (DEPLOYMENT.md §4)
- [ ] Your own funded live test: $1 buy + sell, a protected position, a withdrawal; then `POLYMARKET_LIVE_ENABLED=true`
- [ ] Terms of service + eligibility notice (Polymarket restricts some countries; our server places the orders)

## Next
- [ ] Connect an existing Polymarket account via CLOB-scoped session keys (no custody; SDK supports it)
- [ ] Withdrawal protection: re-auth or email confirmation, address allowlist with a delay
- [ ] Price alerts without trading; partial take-profits (sell 50% at X)
- [ ] Email alerts as an alternative to Telegram
