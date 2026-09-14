# Zircon web application

This is the deployable Zircon application. It runs on Vercel and connects to
Supabase Postgres and hosted KeeperHub; it does not self-host KeeperHub.

```bash
yarn install
yarn prisma generate
yarn lint
yarn tsc --noEmit
yarn build
```

Production deployment and environment-variable instructions are in the root
[DEPLOYMENT.md](../DEPLOYMENT.md).
