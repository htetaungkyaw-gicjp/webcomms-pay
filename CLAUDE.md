# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo currently is

**WebComms & Pay** is a planned multi-tenant SaaS — a passwordless (Email OTP) parent-communication and payments platform for schools, gyms, and clubs (Stripe payments, calendar, parent-teacher booking, announcements). **The production application does not exist yet.** The repo today contains only:

- [.claude/plan/PLAN.md](.claude/plan/PLAN.md) — the full, approved implementation plan (the source of truth for the intended architecture, tech stack, and security decisions). Read this before building any feature.
- [demo/](demo/) — a static, mock-data, vanilla HTML/CSS/JS demo of the concept (no build step, no backend). Served from the `gh-pages` branch via GitHub Pages.
- [.env.example](.env.example), [.mcp.json](.mcp.json), [.gitignore](.gitignore) — bootstrap config.
- [ch-3/](ch-3/), [slides/](slides/) — coursework report and a PechaKucha deck.

When asked to "build" or "implement" a feature, follow PLAN.md — it specifies the exact schema, RLS policies, migrations, and route-handler contracts. Production code (Next.js 16 + Supabase + Stripe) is bootstrapped per **Phase 1** of the plan; it has not been scaffolded yet.

## This is a PUBLIC repo holding payment keys and minors' PII

This is the single most important constraint and it shapes every decision:

- **Never commit a real secret.** All credentials use `${VAR}` env expansion ([.mcp.json](.mcp.json)) or empty placeholders ([.env.example](.env.example)). A service-role key in a public commit = full DB bypass. Any secret that *ever* reaches a commit is compromised → **must be rotated**, not just deleted.
- `.env.local` and `.claude/settings.local.json` are gitignored and must stay untracked. `.claude/settings.json` and `.claude/plan/` are intentionally **tracked**.
- Before any push or making the repo public, run the **Secret Leak Auditor** agent ([.claude/agents/secret-leak-auditor.md](.claude/agents/secret-leak-auditor.md)) as a gate — it scans the tree + git history for key patterns and verifies `.gitignore`/`.mcp.json` hygiene.

## Commands

**Demo** (the only runnable code today — static, no build):
```bash
cd demo && python -m http.server 8000   # then http://localhost:8000
```
Demo login one-time code is `123456`; state is in-browser only and resets on reload.

README screenshots live in `docs/screenshots/` and are captured from the running demo with
a headless browser (Puppeteer). To refresh them, serve `demo/` and re-run the capture
against the landing page, the parent portal (persona "Amelia"), and the system-admin
tenant-switcher view (enter code `123456` on the OTP screen).

**Production app** (once scaffolded per PLAN.md Phase 1 — these will be the working commands):
```bash
npm run dev                              # Next.js 16 dev server
npm run db:types                         # supabase gen types typescript --local > src/types/database.ts
npx supabase start                       # local Postgres in Docker — ALL dev happens here
stripe listen --forward-to localhost:3000/api/stripe/webhook   # local webhook testing
```

## Architecture (the intended production system — see PLAN.md for full detail)

The make-or-break of this system is the **onboarding spine**, and the plan front-loads it as "Phase 0" precisely because getting it wrong invalidates everything downstream:

> invite token (carried through OTP) → trigger binds user to the correct `tenant_id` + `role` → middleware guard → tenant-slug resolution → **RLS** returns correctly-scoped data → one Stripe payment → idempotent webhook flips invoice to `paid`.

Key cross-cutting invariants that span multiple files:

- **Tenant isolation is enforced by Postgres RLS, not app code.** RLS is the true boundary; the `(tenant)/[slug]/layout.tsx` membership check is defense-in-depth, not a replacement. The repo ships an **`rls-policy-check` skill** ([.claude/skills/rls-policy-check/SKILL.md](.claude/skills/rls-policy-check/SKILL.md)) that audits migrations against the tenant-isolation invariants — invoke it when writing or reviewing any SQL under `supabase/migrations/`.
- **The invite token is the authorization proof.** Possession of the invited inbox (OTP) *plus* the unguessable token are both required to bind a user. The `003` `AFTER INSERT ON auth.users` trigger matches token+email on one row; no match → no profile → no access (fail closed).
- **RLS helpers live in the `private` schema** (never `auth` or `public`), are `SECURITY DEFINER` with `SET search_path = ''`, and every tenant-scoped policy must **short-circuit `system_admin` first** (a system_admin has `tenant_id = NULL`, so without the leading `OR` they are locked out of everything).
- **The service-role admin client (`lib/supabase/admin.ts`) bypasses RLS**, so every route handler using it (checkout, booking, invitations, webhook) must **re-authenticate the caller AND authorize the specific resource** (ownership/tenant checks) in code. This is where IDOR and tampering bugs live.
- **`tenant_id` is always derived from the authenticated caller's profile, never from the request body** (the invitations route is the canonical example of cross-tenant injection defense).
- **Stripe checkout is server-authoritative**: amounts come from DB rows, client invoice ids are used only as a filter; the webhook is idempotent (`processed_stripe_events`) and reverse-looks-up invoices by `stripe_checkout_session_id`.
- **Append-only tables** (`audit_log`, `announcement_acknowledgements`) have INSERT-only RLS and no UPDATE/DELETE; `audit_log` is excluded from cascade deletes.
- **Erasure vs. retention is a schema decision, not a feature**: PII cascades on erasure, but `invoices`/payment records are *pseudonymised and retained* (statutory financial-retention obligation), never cascade-deleted.
- **`src/types/database.ts` is committed** (generated, but CI has no DB access). Regenerate with `npm run db:types` after every migration; CI fails if it is stale.
- **The Stripe webhook route is excluded from the middleware matcher** so the raw body survives for signature verification.

## MCP servers ([.mcp.json](.mcp.json))

- **supabase** — started with `--read-only` for safe DB schema/RLS introspection. Use `list_tables` before schema changes and `get_advisors`/`get_logs` when debugging.
- **github** — PRs and repo operations.

Both inject credentials via env-var expansion; the file contains no literal secrets.
