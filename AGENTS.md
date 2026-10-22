# AGENTS.md

Instructions for AI coding agents (and human contributors) working in this repo.

## What this is

An internal time-tracking web app for the staff of **Rifugio Nuvolau** (mountain hut,
Italy). Employees clock work periods and pauses for any day up to today; the owner
(who is not technical) reviews everyone's hours and exports CSVs to compute pay.
Roughly a handful of users — simplicity and clarity beat features. Never add
complexity (rates, payroll math, approvals, notifications) without asking first.

Users: **employees are on phones** (mobile-first, single focused day view),
**the owner is on a laptop** (day view: calendar left, per-employee breakdown right).
Both must be fully usable and nice on both device classes. UI ships in English +
Italian; develop in English, flip `DEFAULT_LANG` to `'it'` in
`apps/web/src/i18n/dictionaries.ts` only when shipping to the rifugio.

## Commands

```sh
pnpm install                  # deps
pnpm db:generate              # regenerate SQL migration after editing the Drizzle schema
pnpm db:local                 # apply migrations to the local D1 database
pnpm dev                      # wrangler dev (0.0.0.0:8787, LAN-visible) + vite (5173, proxies /api)
pnpm build                    # typecheck + build the SPA (must exist before wrangler dev starts)
pnpm typecheck                # all packages
pnpm deploy                   # build web, then wrangler deploy (see README for one-time setup)
```

Dev tips: the Worker serves the *built* SPA from `apps/web/dist` — run `pnpm build`
once before `wrangler dev`. On 8787, wrangler hot-reloads code but assets are read
from disk, so after a web change a browser page reload suffices. Never run two
wrangler dev instances against the same D1 state (SQLite lock crashes). Seeded dev
owner credentials come from `apps/api/.dev.vars` (gitignored).

## Architecture

```
apps/web          React 19 + Vite + Tailwind v4 SPA (views, i18n, query hooks)
apps/api          THE single Cloudflare Worker: Hono API + serves apps/web/dist as static assets
packages/db       Drizzle schema (users, sessions, time_entries) + SQL migrations
packages/shared   Zod schemas + types + time/duration utils — the contract between API and UI
```

pnpm workspaces; strict TypeScript; packages import each other's TS sources directly
(`exports: ./src/index.ts`). One URL serves everything; no CORS anywhere.

## Invariants — read before changing anything

**Time model (most important).** Entries store `workDate` (`YYYY-MM-DD`) +
`startTime`/`endTime` (`HH:mm`) strings, always interpreted in **Europe/Rome**. Never
introduce timestamps, `Date` objects, or local-timezone logic into entry handling;
durations are integer minutes via `hhmmToMinutes` / `entryMinutes` (shared). `24:00`
is a legal end-time sentinel produced when a running entry splits across midnight —
a multi-day span is stored as one row per day (end each day at `24:00`), so day-based
totals stay exact.

**The UTC-formatting trap.** Any date *label* built from a string literal via
`Intl`/`toLocaleDateString` **must** pass `timeZone: 'UTC'` — otherwise the viewer's
timezone shifts the rendered day (this bug shipped three times: month label, day
labels, calendar weekday header). Wall-clock "now" is derived with
`timeZone: 'Europe/Rome'` (`romeNow()` on each side).

**Workday state machine (API `apps/api/src/routes/entries.ts`).**
`idle → /start (work) or /pause`; `work running → /pause (closes work, opens pause)
or /stop`; `pause running → /resume (closes pause, reopens work) or /stop`.
At most **one** running entry per user (`endTime: null`). Every action accepts a
backdated custom date/time (forgetting to clock in/out is the product's core case),
but never a future one (`FUTURE_TIME`). Manual entries via `POST /api/entries`
always have an end time.

**Pauses are unpaid.** Entries carry `kind: 'work' | 'pause'`. All payable totals
(summary, day totals) count `work` only; pause rows render greyed with a badge and
appear in the entries CSV (`Type` column) for visibility. Overlap validation applies
across both kinds per user+date (a running entry reserves `start..24:00`).

**Roles are hard boundaries.** Employees: CRUD only their own entries, any past day,
no future dates. Owner: read-only over everything plus user management
(create → random password shown exactly once, reset, rename, deactivate — never
delete; history must survive). The owner deliberately cannot log time
(`requireEmployee` guards the mutating entry routes).

**Auth.** PBKDF2-SHA-256 via WebCrypto (`apps/api/src/lib/crypto.ts`), DB-backed
sessions, httpOnly `SameSite=Lax` cookie (30 days, sliding renewal). The cookie's
`Secure` flag adapts to the request protocol (plain-HTTP LAN dev must still work).
Login/CSRF: SameSite + an Origin-host check on state-changing requests. Error shape
is `{ error: { code, message } }` with `code` from `ApiErrorCode` — the UI maps codes
to localized strings via `ApiError`/`ErrorNote`.

**i18n.** Every user-visible string lives in both dictionaries (`en` defines the
key shape; `it` mirrors it; `Dictionary = Widen<typeof en>`). No hardcoded copy in
components (a11y `aria-label`s in English are tolerated). Italian uses proper
accents and `’`.

## Conventions

- ESM only; named exports (exceptions: `App` default export, worker entry).
- Tailwind utility classes inline; brand colors come from the `--color-brand-*` theme
  tokens in `apps/web/src/styles.css`. Rounded-2xl cards, stone neutrals.
- Server data flows through react-query (`apps/web/src/api/hooks.ts`): mutations
  invalidate `['entries']`/`['running']`/`['users']`; report data is fetched
  on-demand (`fetchReportSummary`/`fetchReportDetail`), not stored in app state.
- Zod schemas live in shared; API handlers validate with `validateJson`/`validateQuery`
  wrappers (they emit our error shape). Keep shared types the single source of truth —
  API responses must match `TimeEntry`/`UserPublic`/`Report*` exactly.
- Swipes on the employee day view: left = previous day, right = next; **today is the
  rightmost boundary** (enforced in `go()`).

## Known traps

- When writing smoke tests/scripts, compute "now" in Rome (`date -r` won't do; the
  dev machine may be in another timezone) — daytime test hours fail around Rome's
  midnight with `FUTURE_TIME`, which once looked like an API bug but wasn't.
- `grid-cols-[a,b]` is invalid CSS — Tailwind arbitrary track lists need an
  underscore for the space: `grid-cols-[420px_minmax(0,1fr)]`.
- GitHub repo is private; keep it that way. Never commit `apps/api/.dev.vars`,
  `rifugio-nuvolau-domain-plan.md` (personal deployment plan, intentionally local),
  or `.openchamber/` (tooling captures) — all gitignored, keep them that way.
