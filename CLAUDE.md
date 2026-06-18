# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

**WebComms & Pay** is a multi-tenant SaaS — a passwordless (Email OTP) parent-communication and payments platform for schools, gyms, and clubs (Stripe payments, calendar, parent-teacher booking, announcements). The repo contains:

- **The Phase 0 walking skeleton** — a thin but real end-to-end slice of the production app (Next.js 16 App Router + Supabase + Stripe) under [src/](src/) and [supabase/](supabase/). This proves the onboarding spine and tenant isolation end-to-end before features are built on top.
- [.claude/plan/PLAN.md](.claude/plan/PLAN.md) — the full, approved implementation plan and the source of truth for schema, RLS policies, migrations, and route-handler contracts. **Read this before building any feature**; it specifies the exact contracts the code implements.
- [demo/](demo/) — a separate static, mock-data, vanilla HTML/CSS/JS demo of the concept (no build, no backend). Served from `gh-pages` via GitHub Pages. This is a marketing/illustration artifact, **not** the app in `src/`.
- [ch-3/](ch-3/), [slides/](slides/) — coursework report and a PechaKucha deck.

When asked to build a feature, follow PLAN.md and extend the existing skeleton; do not re-derive the architecture.

## This is a PUBLIC repo holding payment keys and minors' PII

This is the single most important constraint and it shapes every decision:

- **Never commit a real secret.** All credentials use `${VAR}` env expansion ([.mcp.json](.mcp.json)) or empty placeholders ([.env.example](.env.example)). A service-role key in a public commit = full DB bypass. Any secret that *ever* reaches a commit is compromised → **must be rotated**, not just deleted.
- `.env.local` and `.claude/settings.local.json` are gitignored and must stay untracked. `.claude/settings.json` and `.claude/plan/` are intentionally **tracked**.
- Before any push or making the repo public, run the **Secret Leak Auditor** agent ([.claude/agents/secret-leak-auditor.md](.claude/agents/secret-leak-auditor.md)) as a gate — it scans the tree + git history for key patterns and verifies `.gitignore`/`.mcp.json` hygiene.

## Commands

**Local dev loop:**
```bash
npx supabase start          # local Postgres + Auth + Studio + Mailpit (email) in Docker
npm run dev                 # Next.js 16 dev server → http://localhost:3000
npm run db:types            # regenerate src/types/database.ts from the local DB
npm run lint                # eslint (eslint-config-next)
```
- **Where the running app points is set by `.env.local`** — see "Environments" below. The
  `dev` environment runtime targets the **cloud** Supabase project; the local Docker stack
  above is for migration authoring, `db reset`, typegen, and the verification harnesses.
  Migration files (`supabase/migrations/*`) are environment-agnostic — author and prove
  them locally, then push to a cloud project deliberately (`link → db diff → db push`).
  **Never blind-`db push`**; never run the `verify-*.mjs` harnesses against a cloud DB
  (they seed/mutate and assume the local demo keys).
- `supabase start` applies `supabase/migrations/*` and runs `supabase/seed.sql`. To re-apply migrations from scratch: `npx supabase db reset`.
- **Mailpit** (local email/OTP inbox) web UI and API are on the inbucket port from [supabase/config.toml](supabase/config.toml) (`http://127.0.0.1:54324`). OTP codes are read from there in local dev — there is no real email send.
- Supabase Studio + the local API/anon/service keys are printed by `supabase start`; put them in `.env.local` (see [.env.example](.env.example) for the full var list).

**Stripe (local):**
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook   # forward webhooks; prints the signing secret → STRIPE_WEBHOOK_SECRET
```

**Verification harnesses** (these are the test suite — there is no Jest/Vitest setup). Both load env from `.env.local` and require the dev stack up:
```bash
node --env-file=.env.local scripts/verify-phase0.mjs    # drives the REAL onboarding spine via supabase-js + Mailpit OTP, then asserts tenant isolation / fail-closed through RLS
node --env-file=.env.local scripts/verify-payment.mjs   # creates a real test Checkout Session, then delivers a properly-signed webhook event (exercises constructEvent + idempotency + paid-flip)
```
`verify-phase0.mjs` is the Phase 0 exit-criteria gate — run it after any change to migrations, the onboarding trigger, RLS, or auth flow. `verify-payment.mjs` covers the payment leg.

**Demo** (the separate static artifact, not the app):
```bash
cd demo && python -m http.server 8000   # → http://localhost:8000 ; OTP code 123456, in-browser state, resets on reload
```
README screenshots in `docs/screenshots/` are captured from the running demo (landing, parent portal as "Amelia", system-admin tenant-switcher via code `123456`).

## Architecture

Path alias: `@/*` → `src/*`. Stack: Next.js 16 (App Router, TS) · Supabase (Postgres · Email OTP · RLS) · Stripe.

### Environments (diverges from PLAN.md's Vercel + local-only-dev assumptions)
| env  | frontend       | database (cloud Supabase) | Stripe |
|------|----------------|---------------------------|--------|
| dev  | local (Docker) | shared project ↓          | TEST   |
| stg  | **Netlify**    | shared with dev           | TEST   |
| prod | **Netlify**    | separate project          | LIVE   |
- Hosting is **Netlify** (not Vercel): deploy via `@netlify/plugin-nextjs` + Netlify env
  contexts, not `vercel --prod`. Rate-limiting is Upstash Redis in all envs.
- dev + stg **share one Supabase project** (test data and dev data co-mingle — split before
  stg holds real tester PII). Supabase **region is Asia Pacific** and is a one-way door per
  project; prod compliance framing under AP is an open question (not the plan's UK/EU GDPR).
- **CI stays hermetic-local**: it runs `supabase start` for typegen/RLS checks with **no
  Supabase token in CI** (public repo) — only the app runtime uses cloud. (CI workflow not
  yet added; see PLAN.md §5.)
- **Per-environment key separation is mandatory**: prod = Stripe LIVE; dev/stg = Stripe TEST,
  each with its own `STRIPE_WEBHOOK_SECRET`. A Netlify preview must never carry prod creds.

The make-or-break of this system is the **onboarding spine**, front-loaded as "Phase 0" because getting it wrong invalidates everything downstream:

> invite token (carried through OTP) → `003` trigger binds user to the correct `tenant_id` + `role` → middleware guard → `[slug]` tenant resolution → **RLS** returns correctly-scoped data → one Stripe payment → idempotent webhook flips invoice to `paid`.

### Route map (App Router groups)
- `(auth)/` — [login](src/app/(auth)/login/page.tsx), [verify](src/app/(auth)/verify/page.tsx) (OTP), [accept-invite](src/app/(auth)/accept-invite/page.tsx). Client forms in [src/components/auth/](src/components/auth/).
- `(tenant)/[slug]/` — [layout.tsx](src/app/(tenant)/[slug]/layout.tsx) (tenant resolution + membership guard), `portal/` (parent), `manage/` (admin).
- `(dashboard)/admin/` — cross-tenant system-admin view.
- `api/stripe/` — [checkout](src/app/api/stripe/checkout/route.ts), [webhook](src/app/api/stripe/webhook/route.ts). `api/auth/signout`.
- Supabase clients in [src/lib/supabase/](src/lib/supabase/): `browser.ts` (client), `server.ts` (RLS-respecting SSR), `admin.ts` (**service-role, bypasses RLS**). Stripe client in [src/lib/stripe.ts](src/lib/stripe.ts) via `getStripe()`.
- Migrations `001`–`004` in [supabase/migrations/](supabase/migrations/): `001` schema, `002` RLS, `003` onboarding trigger, `004` seed first admin.

### Cross-cutting invariants (span multiple files — these are the load-bearing rules)
- **Tenant isolation is enforced by Postgres RLS, not app code.** RLS ([002_rls_policies.sql](supabase/migrations/002_rls_policies.sql)) is the true boundary; the `(tenant)/[slug]/layout.tsx` membership check is defense-in-depth, not a replacement. The repo ships an **`rls-policy-check` skill** ([.claude/skills/rls-policy-check/SKILL.md](.claude/skills/rls-policy-check/SKILL.md)) — invoke it when writing or reviewing any SQL under `supabase/migrations/`.
- **The invite token is the authorization proof.** Possession of the invited inbox (OTP) *plus* the unguessable token are both required. The `003` `AFTER INSERT ON auth.users` trigger ([handle_new_user](supabase/migrations/003_onboarding.sql)) matches token+email on one row; no match → no profile → no access (fail closed).
- **RLS helpers live in the `private` schema** (never `auth`/`public`), are `STABLE SECURITY DEFINER` with `SET search_path = ''`, fully-qualified inside, and wrapped in `(SELECT ...)` at call sites so the planner evaluates them once per query. Every tenant-scoped policy must **short-circuit `system_admin` first** (system_admin has `tenant_id = NULL`, so without the leading `OR` they are locked out of everything). A disabled/missing profile yields NULL role+tenant → matches nothing (fail closed).
- **The service-role admin client ([lib/supabase/admin.ts](src/lib/supabase/admin.ts)) bypasses RLS**, so every route handler using it (checkout, booking, invitations, webhook) must **re-authenticate the caller AND authorize the specific resource** in code. [checkout/route.ts](src/app/api/stripe/checkout/route.ts) is the canonical IDOR defense: `getUser()` → re-fetch invoices filtered by `student.parent_id = user.id` and `status='pending'`, reject if fewer rows return than requested.
- **`tenant_id` is always derived from the authenticated caller's profile, never from the request body.**
- **Stripe checkout is server-authoritative**: `line_items` amounts come from DB rows (cents), client invoice ids are used only as a filter; the [webhook](src/app/api/stripe/webhook/route.ts) is idempotent (first-writer-wins INSERT into `processed_stripe_events`) and reverse-looks-up invoices by `stripe_checkout_session_id`.
- **Append-only tables** (`audit_log`, `announcement_acknowledgements`) have INSERT-only RLS and no UPDATE/DELETE; `audit_log` is excluded from cascade deletes.
- **Erasure vs. retention is a schema decision**: PII cascades on erasure, but `invoices`/payment records are *pseudonymised and retained* (statutory financial-retention obligation), never cascade-deleted.
- **`src/types/database.ts` is committed** (generated, but CI has no DB access). Regenerate with `npm run db:types` after every migration; CI fails if it is stale.
- **The Stripe webhook route is excluded from the [middleware](src/middleware.ts) matcher** so the raw body survives `constructEvent` signature verification. Middleware uses `getUser()` (revalidates the JWT), not `getSession()`.

## MCP servers ([.mcp.json](.mcp.json))

- **supabase** — the **hosted HTTP MCP** (`https://mcp.supabase.com/mcp?project_ref=boxolvxrifxbvzuchxyq`),
  pinned to the dev/stg project. **Writable** (no `--read-only`) — it can apply migrations and
  run SQL, so treat it with the same care as the service-role client. Use `list_tables` before
  schema changes and `get_advisors`/`get_logs` when debugging. The `project_ref` is not a secret.
- **github** — PRs and repo operations; injects `${GITHUB_PERSONAL_ACCESS_TOKEN}` via env expansion.

Neither file entry contains a literal secret (the project ref is public; the GitHub token is `${...}`).
