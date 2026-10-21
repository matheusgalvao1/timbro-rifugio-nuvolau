# Timbro Rifugio Nuvolau

Time-tracking app for the staff of Rifugio Nuvolau. Employees clock in/out (with
correctable start/stop times) and log/edit their own work entries for any past
day; the owner views everyone's hours, generates reports over any period for any
subset of employees (CSV export), and manages accounts.

Employees: **mobile-first** · Owner: **laptop-first** · both fully responsive.
UI ships in **English + Italian** (Italian is the intended default for the rifugio).

## Stack

- Single **Cloudflare Worker** (`apps/api`, Hono) serving both the API and the
  built SPA (`apps/web`, React + Vite + Tailwind v4) from one URL.
- **D1** (SQLite) database, schema/migrations in `packages/db`.
- Shared Zod schemas & types in `packages/shared` — one source of truth.
- Auth: PBKDF2 (WebCrypto) password hashes, DB-backed sessions in an
  httpOnly `Secure` `SameSite=Lax` cookie (30 days, sliding renewal).
- Times are stored as `work_date` (`YYYY-MM-DD`) + `HH:mm`, always in
  **Europe/Rome** — never timestamps, so DST and off-by-one issues don't exist.

## Monorepo layout

```
apps/web          React SPA (Vite, Tailwind, i18n en/it)
apps/api          Hono Worker: API + static asset serving + D1
packages/db       Drizzle schema + SQL migrations
packages/shared   Zod schemas, types, time/duration utils
```

## Local development

```sh
pnpm install
pnpm db:generate   # (only after editing packages/db/src/schema.ts)
pnpm db:local      # apply migrations to the local D1 database
pnpm dev           # vite (5173, proxies /api) + wrangler dev (8787)
```

Seeded owner account for dev comes from `apps/api/.dev.vars`
(see `.dev.vars.example`). Open http://localhost:5173 and log in.

## Deploy

```sh
# one-time
wrangler d1 create timbro-nuvolau --location weur   # EU region; copy the id into apps/api/wrangler.jsonc
pnpm --filter @nuvolau/api wrangler secret put ADMIN_USERNAME
pnpm --filter @nuvolau/api wrangler secret put ADMIN_PASSWORD
# every release
pnpm db:local -- --remote   # or: wrangler d1 migrations apply timbro-nuvolau --remote
pnpm deploy                 # builds apps/web then wrangler deploy from apps/api
```

`ADMIN_USERNAME` / `ADMIN_PASSWORD` bootstrap the owner account on first
request; the owner can change both from the app afterwards. If unset, the
worker generates a random owner password and logs it once (dev convenience —
always set the secrets in production).
