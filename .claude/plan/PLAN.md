# WebComms & Pay — Implementation Plan (v3, post-PM + Cybersecurity review)

## Context

Greenfield multi-tenant web platform for schools, gyms, and clubs. Parents log in via Email OTP (passwordless) to manage tuition payments, view school calendars, book parent-teacher meetings, and read announcements. The repo currently contains only a README and .git — no code exists yet. Claude Code CLI executes all phases. The repo is **public on GitHub**, so secrets must never be committed.

**v2** added an invitation/onboarding flow as the spine, a Phase 0 walking skeleton to de-risk the auth→tenant→RLS integration, and fixed the booking/checkout/RLS security model (the original plan had no way to place a user into a tenant → every user locked out).

**v3 (this revision)** is a **security + compliance hardening pass** (PM + Cybersecurity Manager review). It fixes three inconsistencies v2 itself introduced (the invitation **token was decorative** — never verified; the **student↔parent first-link** was unspecified; **Phase 0** didn't actually exercise the real onboarding spine), closes authn/authz gaps (verifyOtp brute-force, stale-JWT revocation, cross-tenant invite injection, stored XSS), and moves **schema- and contract-level compliance decisions earlier** (erasure-vs-retention conflict, audit logging, controller/processor + DPA) because they cannot be retrofitted or "deferred in writing." Changes are marked **[v3]** throughout.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Frontend/Backend | **Next.js 16** (App Router, TypeScript) — `create-next-app@latest` installs 16.x as of 2026 |
| Database & Auth | Supabase (PostgreSQL + Email OTP + RLS) |
| Hosting | Vercel |
| Payments | Stripe |
| Email delivery | Resend (Supabase Auth SMTP + transactional) |
| Rate limiting | **Upstash Redis** (`@upstash/ratelimit`) — user has Upstash experience |
| UI | shadcn/ui + Tailwind CSS |
| Forms | react-hook-form + zod |
| State/cache | TanStack Query v5 |
| Calendar | react-big-calendar (rendered in a Client Component) |
| Toasts | sonner |

---

## Security & Process Ground Rules (apply to every phase)

- `.env.local` is gitignored — never commit it. Provide `.env.example` with empty placeholders.
- `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `UPSTASH_*` are **server-only**. Never import a file containing them from a Client Component.
- Stripe webhook route is excluded from the middleware matcher so the raw body is preserved for signature verification.
- The service-role Supabase client (`lib/supabase/admin.ts`) is used **only** in Route Handlers — and because it **bypasses RLS, every admin-client handler must re-authenticate the caller AND authorize the specific resource** (ownership/tenant checks) before reading or writing.
- **`src/types/database.ts` is COMMITTED** (generated, but CI has no DB access so it must be in the repo). Regenerate after every migration via `npm run db:types`; CI fails if it's stale.
- **Migrations are developed against a LOCAL Supabase** (`supabase start`) or a dedicated dev project — never `db push` to production during development. Production migration is a gated Phase-5 step.
- **Choose the Supabase region deliberately at project creation** (EU/UK if serving UK/EU schools — region cannot be changed later, and the data includes minors' PII).
- **[v3] Secret-leak defense is layered, not just `.gitignore`** (a public repo holding a Supabase service-role key = full DB bypass demands depth):
  - `.gitignore` (Phase 1, before first commit) must include `.env`, `.env*.local`, **`.claude/settings.local.json`** (Claude Code writes local permission grants/paths here — currently untracked and unignored in this repo), `node_modules/`, `.next/`, `.vercel/`, `*.pem`. Keep `.claude/settings.json` and `.claude/plan/` tracked.
  - Enable **GitHub Secret Scanning + Push Protection** (free on public repos) — blocks known-pattern secrets at push time.
  - **gitleaks pre-commit hook** (via lefthook/husky) + a **gitleaks CI step** on every PR. The Phase 5 "grep for SERVICE_ROLE_KEY" check becomes an automated job, landed in Phase 1.
  - **Rule:** any secret that ever reaches a commit on a public repo is **compromised → must be rotated**, not just deleted. Run `gitleaks detect --all` over history as a Phase 1 baseline.
- **[v3] Per-environment key separation is mandatory:** Production scope = prod Supabase + Stripe **LIVE**; Preview/Dev scope = dev Supabase + Stripe **TEST**, each with its **own** `STRIPE_WEBHOOK_SECRET`. A Vercel Preview deploy must never carry prod credentials or reach prod data. Use a **Stripe restricted key** (scoped to Checkout) not the full secret key. Document a rotation cadence (quarterly + on suspected leak) for the service-role key, Stripe key, Resend key, Upstash token.
- **[v3] Supply-chain hygiene:** commit `package-lock.json` and use `npm ci` (reproducible installs); pin payments-critical deps to exact versions (no `^` on `stripe`, `@supabase/*`, `@upstash/*`); add `npm audit --audit-level=high` + Dependabot/Renovate; CI uses least-privilege `permissions: contents: read` and **action SHAs pinned** (not mutable tags).

---

## Phase 0 — Walking Skeleton (de-risk the spine FIRST)

> **Why this phase exists:** the make-or-break integration is OTP login → profile bound to the correct `tenant_id`+`role` → middleware guard → tenant-slug resolution → RLS returning correctly-scoped data → one Stripe payment → webhook flips invoice to `paid`. If the auth/tenant binding is wrong, Phases 2–4 are invalidated. Prove it end-to-end on a thin slice before fanning out.

**Goal:** prove the **real onboarding spine end-to-end** (not a direct-seed shortcut) plus tenant isolation and one payment. **[v3] Phase 0 is the binding contract that forces the token-vs-email and student-linking decisions to be resolved before any CRUD is built** — these were the parts most likely to be wrong, so they must be the parts Phase 0 actually exercises.

Steps:
1. Bootstrap Next.js 16 + minimal deps (Supabase SSR, Stripe). (Subset of Phase 1-B.)
2. `supabase start` (local). Apply a minimal schema that **[v3] INCLUDES `invitations` + the `003` trigger** (and `students.parent_email`, `profiles.status`): `tenants`, `profiles`, `invitations`, `students`, `invoices` + RLS helpers/policies for those (final pattern). Without `invitations`, the `AFTER INSERT ON auth.users` trigger throws — so it must be present.
3. **[v3] Bootstrap via the real invitation path, not direct `auth.users` seeding:** seed Tenant A + B and an `invitations` row for the `system_admin` and for one `tenant_admin` + one `parent` per tenant; for Tenant A's parent, also pre-create a `student` with `parent_email` set (to prove linking). Each principal logs in via OTP carrying their invite token → the trigger binds them. (Direct seeding is allowed only for throwaway *secondary* fixtures the spine doesn't need to prove.)
4. Implement: `lib/supabase/{browser,server,admin}.ts`, `middleware.ts`, OTP login + verify **with `invite_token` passed through**, `/accept-invite`, `(tenant)/[slug]/layout.tsx` slug resolution + membership guard, a single invoice list page, `PayAllButton`, `/api/stripe/checkout`, `/api/stripe/webhook`.
5. **Prove the spine + isolation:** accept an invite as Tenant A parent (token+OTP) → land in Tenant A with role `parent` → **see the pre-created student linked** → see their invoice; pay it (test card) → webhook flips to `paid`. Attempt Tenant B's slug → empty / `notFound()`. Log in as `system_admin` → see both tenants. Attempt to bind with a **wrong/absent token** → no profile, no access.

**Phase 0 exit criteria (all must pass — these are the v3 decision gates):**
- [ ] A parent onboards via **invitation token + OTP** (NOT direct seed) and lands in the correct tenant/role
- [ ] **Wrong/missing invite token → no profile created → no access** (proves the token is verified)
- [ ] Admin-pre-created student (via `parent_email`) is **linked and visible** to the parent after first login
- [ ] Parent A sees exactly their 1 invoice; sees 0 of Tenant B's rows; direct query for a Tenant B invoice id returns empty (RLS, not app logic)
- [ ] Stripe test payment → webhook → invoice `paid` in DB
- [ ] `system_admin` sees both tenants (role short-circuit works)
- [ ] A `disabled` parent (set `profiles.status='disabled'`) can no longer read tenant data (proves the revocation fail-closed)

Only after Phase 0 passes do we proceed to build out the full schema and CRUD.

---

## Phase 1 — Infrastructure Setup

### 1-A. Bootstrap Next.js project

Run from the repo root (empty except README + .git):

```bash
npx create-next-app@latest . \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*"
```
(Accept the Next.js 16 defaults. Note Next 16 enables Turbopack/PPR-era defaults — verify the dev server boots before proceeding.)

### 1-B. Install dependencies

```bash
npm install \
  @supabase/ssr @supabase/supabase-js \
  stripe @stripe/stripe-js \
  resend \
  @upstash/ratelimit @upstash/redis \
  zod react-hook-form @hookform/resolvers \
  date-fns date-fns-tz react-big-calendar \
  lucide-react next-themes sonner \
  clsx tailwind-merge \
  @tanstack/react-query

npm install -D @types/react-big-calendar supabase
```
**Dropped from v1:** `svix` (Stripe SDK verifies its own webhook signatures — dead weight). **Added:** `@upstash/ratelimit` + `@upstash/redis` (OTP abuse control), `date-fns-tz` (slot timezones).

### 1-C. Shadcn init + components

```bash
npx shadcn@latest init
npx shadcn@latest add button card input label badge dialog sheet tabs \
  table skeleton avatar dropdown-menu separator alert popover
```
(Dropped shadcn `calendar` — `react-big-calendar` is the calendar lib; the shadcn date-picker calendar would only be needed for a date input, add later if required.)

### 1-D. Environment variables

`.env.example` (committed):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
RESEND_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_APP_URL=
```
`.env.local` (never committed). `NEXT_PUBLIC_SUPABASE_URL` differs per environment (local vs dev vs prod).

### 1-E. Resend sending domain — DO THIS ON DAY 1 (critical path)

OTP is the **only** way to log in, and Resend won't deliver from a custom domain until SPF/DKIM/DMARC DNS records are added and verified (propagation: hours–day, needs registrar access). Start now so it overlaps the build:
1. Add the sending domain in Resend → add the DNS records at the registrar → wait for "Verified".
2. Until verified, use Resend's onboarding domain for local dev only (cannot deliver to arbitrary inboxes).
3. **Gate:** a verified domain is required before any external tester logs in.

### 1-F. Supabase — local-first

```bash
npx supabase login
npx supabase init          # creates supabase/ + config.toml
npx supabase start         # local Postgres in Docker — ALL dev happens here
```
Create the **prod** project in the dashboard with the correct **region** chosen deliberately. Do **not** link/push to it until Phase 5.

### 1-G. Database migrations

**`supabase/migrations/001_initial_schema.sql`** — enums + all tables. Changes vs v1:
- New table **`invitations` (id, `tenant_id UUID NULL`, email, role, token UNIQUE, expires_at, accepted_at, created_at)** — the onboarding spine. **`tenant_id` is NULLABLE** because a `system_admin` invitation belongs to no tenant. **`profiles.tenant_id` is likewise NULLABLE** (system_admin has none). Add a CHECK: `tenant_id IS NOT NULL OR role = 'system_admin'` (only system_admin invites may omit a tenant).
- `teachers` gains **`class_name`** (or add a `teacher_students` join table) so a child's teacher is expressible.
- `appointment_slots` **drops `is_booked`** (it's a desyncable duplicate; the unique index below is the source of truth). Availability is derived: a slot is free iff no non-cancelled appointment references it.
- `appointment_slots` times stored as **`timestamptz`** (or keep naive `time` + a `tenants.timezone` IANA column and always interpret against it). Add `tenants.timezone`.
- `invoices` gains **`stripe_checkout_session_id`** (reverse lookup from webhook — avoids the 500-char metadata cap).
- `profiles.email` kept for admin lookup but treated as a denormalized cache of `auth.users.email` (documented; not a source of truth).
- A **`processed_stripe_events` (event_id PRIMARY KEY, processed_at)** table for webhook idempotency.
- **[v3] `students` gains `parent_email TEXT NULL`** — the admin sets this when creating a child before the parent has an account; the `003` trigger links `parent_id` on the parent's first login (fixes the chicken/egg, see 003).
- **[v3] `profiles` gains `status` (`active` | `disabled`, default `active`)** — enables revocation. RLS helpers and the membership guard must treat `disabled`/missing profiles as no-access (fail closed). On disable/role-change, the admin route calls `auth.admin.signOut(userId)` to invalidate refresh tokens so the change takes effect at next refresh (DB RLS is immediate).
- **[v3] New `audit_log` table** `(id, tenant_id, actor_id, actor_role, action, target_table, target_id, metadata jsonb, created_at)` — **append-only** (INSERT-only RLS, no UPDATE/DELETE, mirroring `announcement_acknowledgements`), tenant-scoped read for tenant_admin. Written from admin-client routes for security-relevant events: invitation create/accept, role/status change, student create/delete, **data export, erasure**, and admin reads of student/invoice data. Required for "who accessed this child's record" (GDPR accountability + school security questionnaires); cannot be retrofitted cleanly. **Excluded from cascade deletes.**

Tables: `tenants`, `profiles`, `invitations`, `students`, `invoices`, `events`, `teachers`, `appointment_slots`, `appointments`, `announcements`, `announcement_acknowledgements`, `processed_stripe_events`, **`audit_log` [v3]**.

**[v3] Erasure vs. retention — split by data class (this is a schema decision, NOT a Phase 5 detail).** A blanket `ON DELETE CASCADE` that deletes invoices when a parent is erased is itself unlawful: financial records carry a statutory retention obligation (UK HMRC ~6 yrs; AML/PSD2), and GDPR Art. 17(3)(b) disapplies erasure where retention is legally required. So:
- **Erasable / cascade-deletable:** child & parent profile PII, educational data (students' names/classes, announcements, appointments).
- **Retained, NOT cascade-deleted:** `invoices` / payment references. On parent/student erasure, **pseudonymise** — set `student_id`/person links to a tombstone (`ON DELETE SET NULL` + an anonymisation routine), keep amount/date/tax fields for the statutory window.
- Document a **retention schedule per table** (financial = 6–7 yrs then purge; PII = delete on account closure or per controller instruction; `invitations` purged after expiry+grace; `audit_log` per policy) and a **scheduled cleanup job** (Supabase scheduled function / cron). Add a test that erasing a parent removes PII but retains pseudonymised invoices.

Double-booking guard (unchanged, now the sole source of truth). **`appointments.status` MUST be `NOT NULL DEFAULT 'pending'`** — a NULL status would make `status != 'cancelled'` evaluate to NULL and silently exclude the row from the partial index, allowing a double-book:
```sql
-- status appointment_status NOT NULL DEFAULT 'pending'
CREATE UNIQUE INDEX appointments_slot_active_idx
  ON appointments (slot_id) WHERE status != 'cancelled';
```

**`supabase/migrations/002_rls_policies.sql`** — RLS on every table. **Corrected helper placement & safety:**

```sql
-- Helpers live in a PRIVATE (non-API-exposed) schema, NOT in `auth` (reserved by Supabase)
-- and NOT in `public` (exposed). search_path is pinned empty; all refs fully-qualified.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.current_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT tenant_id FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION private.current_role()
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid() $$;
```

**Every tenant-scoped policy short-circuits `system_admin` first** (fixes the NULL-tenant lockout) and wraps helper calls in a subselect so the planner evaluates them **once per query, not per row**:

```sql
-- SELECT template (tenant members read their tenant; system_admin reads all):
CREATE POLICY "<table>_select" ON <table> FOR SELECT USING (
  (SELECT private.current_role()) = 'system_admin'
  OR tenant_id = (SELECT private.current_tenant_id())
);

-- WRITE template (tenant_admin within tenant; system_admin anywhere):
CREATE POLICY "<table>_write" ON <table> FOR ALL USING (
  (SELECT private.current_role()) = 'system_admin'
  OR (tenant_id = (SELECT private.current_tenant_id())
      AND (SELECT private.current_role()) = 'tenant_admin')
) WITH CHECK ( /* same predicate */ );
```

Per-table specifics:
- `tenants`: members SELECT own + system_admin all; INSERT/UPDATE system_admin only.
- `profiles`: own row always; tenant_admin/system_admin see tenant; INSERT self.
- `invitations`: **must preserve the `system_admin OR` escape** in BOTH USING and WITH CHECK, then AND the tenant_admin restriction. Explicit form (do NOT use the bare template here):
  ```sql
  CREATE POLICY "invitations_write" ON invitations FOR ALL
  USING (
    (SELECT private.current_role()) = 'system_admin'
    OR (tenant_id = (SELECT private.current_tenant_id())
        AND (SELECT private.current_role()) = 'tenant_admin')
  )
  WITH CHECK (
    -- system_admin may create ANY invitation, including another system_admin (tenant_id NULL)
    (SELECT private.current_role()) = 'system_admin'
    -- tenant_admin may invite only into their own tenant, and NEVER a system_admin
    OR (tenant_id = (SELECT private.current_tenant_id())
        AND (SELECT private.current_role()) = 'tenant_admin'
        AND role <> 'system_admin')
  );
  ```
  This is the gap the bare template missed: without the leading `system_admin OR`, a system_admin (whose `current_tenant_id()` is NULL) could not insert a tenant-less system_admin invite. SELECT by token at accept time is done server-side via the service-role client.
- `students`: parent sees own (`parent_id = auth.uid()`); tenant_admin/system_admin see tenant; writes tenant_admin.
- `invoices`: parent sees only invoices for their own students (subselect on `students.parent_id = auth.uid()`); writes tenant_admin.
- `events`, `teachers`, `announcements`: tenant members read; tenant_admin writes. **Add explicit DELETE** (covered by `FOR ALL`).
- `appointment_slots`: tenant members read; tenant_admin writes. (No `is_booked`.)
- `appointments`: parent SELECT/INSERT own (`parent_id = auth.uid()`), tenant_admin SELECT+UPDATE tenant. **Note:** the booking *insert* goes through the admin client (see Phase 4) and is authorized in code, not RLS — but the RLS policy still exists as defense-in-depth for any non-admin-client path.
- `announcement_acknowledgements`: SELECT if the announcement is in your tenant; **INSERT only `parent_id = auth.uid()`**; **explicit no UPDATE / no DELETE** (an acknowledgement is immutable — omit those policies so they're denied by default).
- `processed_stripe_events`: no policies → only the service-role client (webhook) touches it.

**`supabase/migrations/003_onboarding.sql`** — the spine (replaces the old naive auto-create trigger):
```sql
-- On new auth user, bind them to a tenant+role IF a valid invitation exists for their email.
-- [v3] Binds by TOKEN + email (token was decorative in v2 — a privilege-escalation hole).
-- The invite token is carried through OTP in user metadata and matched on the SAME row.
-- No matching token => no profile row (they cannot access anything; surfaced as "not invited").
-- Also links any pre-created students for this parent (fixes the chicken/egg).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE inv public.invitations;
BEGIN
  -- Match on token AND email AND validity — fail closed if the token is absent/wrong.
  SELECT * INTO inv FROM public.invitations
    WHERE token = NEW.raw_user_meta_data->>'invite_token'
      AND email = NEW.email
      AND accepted_at IS NULL
      AND expires_at > now()
    LIMIT 1;
  IF inv.id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, tenant_id, role, status)
    VALUES (NEW.id, NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name',''),
            inv.tenant_id, inv.role, 'active')
    ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, role = EXCLUDED.role;
    UPDATE public.invitations SET accepted_at = now() WHERE id = inv.id;
    -- [v3] Link any students the admin pre-created for this parent's email, scoped to the tenant.
    IF inv.role = 'parent' THEN
      UPDATE public.students
        SET parent_id = NEW.id
        WHERE parent_email = NEW.email AND tenant_id = inv.tenant_id AND parent_id IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```
**[v3] The token is now the authorization proof, carried end-to-end:** `/accept-invite?token=…&email=…` → the OTP send passes the token in `signInWithOtp({ email, options: { data: { invite_token } } })` → on first `verifyOtp`, the trigger matches the token+email on one row. Possession of the invited inbox (OTP) **plus** the unguessable token are both required — closes the "anyone who knows an invited email can self-bind" hole. (Tokens are unguessable UUIDs; treat them as secrets — short expiry, single-use via `accepted_at`.)
**First `system_admin` bootstrap — committed approach: a tenant-less invitation, NOT direct `auth.users` seeding.** Direct `auth.users` inserts require hashing Supabase's internal fields and are fragile; instead seed only an `invitations` row, then the admin logs in normally and the `003` trigger binds them. This is consistent now that `invitations.tenant_id` is nullable (above):

`supabase/migrations/004_seed_first_admin.sql`:
```sql
-- The very first platform admin. tenant_id is NULL (system_admin has no tenant).
-- Replace the email; this is the ONLY seeded credential. Idempotent.
INSERT INTO public.invitations (email, role, tenant_id, token, expires_at)
VALUES ('admin@webcommspay.example', 'system_admin', NULL,
        gen_random_uuid()::text, now() + interval '30 days')
ON CONFLICT DO NOTHING;
```
Then: that email goes to `/login` → OTP code → `verifyOtp` → the `003` trigger finds the invitation, creates a `profiles` row with `role='system_admin'`, `tenant_id=NULL`, and marks the invite accepted. No direct `auth.users` manipulation. (Phase 0 step 3 may still seed `auth.users`+`profiles` directly for *test fixtures* in the throwaway local DB, but the real bootstrap path is this invitation.)

```bash
npx supabase gen types typescript --local > src/types/database.ts   # local during dev
```
`package.json`: `"db:types": "supabase gen types typescript --local > src/types/database.ts"`. **[v3] CI also uses `--local` (hermetic `supabase start` in the runner) — no `--project-id`/DB credential in CI.** A one-off `--project-id <ref>` is fine for a *manual, local* check against the prod project, never in the CI workflow.

### 1-H. Directory structure

```
src/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (auth)/verify/page.tsx
│   ├── (auth)/accept-invite/page.tsx        ← NEW: invitation acceptance entry
│   ├── (dashboard)/admin/...                ← system_admin: tenants CRUD + invite tenant_admin
│   ├── (tenant)/[slug]/layout.tsx           ← resolves tenant, asserts caller membership
│   ├── (tenant)/[slug]/manage/...           ← tenant_admin CRUD (incl. invite parents)
│   ├── (tenant)/[slug]/portal/...           ← parent portal (4 tabs)
│   │   (NO api/auth/callback — pure OTP-code flow needs no redirect callback; see Phase 2)
│   ├── api/invitations/route.ts             ← NEW: create invitation (admin) + send email
│   ├── api/stripe/checkout/route.ts
│   ├── api/stripe/webhook/route.ts
│   ├── api/appointments/book/route.ts
│   ├── error.tsx · global-error.tsx · not-found.tsx · loading.tsx   ← NEW
│   ├── payment-success/page.tsx · payment-cancelled/page.tsx
├── components/{ui, auth, dashboard, tenant, providers}/...
├── lib/
│   ├── supabase/{browser,server,admin}.ts
│   ├── ratelimit.ts                         ← NEW: Upstash limiter for OTP
│   ├── stripe.ts · resend.ts · utils.ts
├── types/database.ts                        ← COMMITTED
└── middleware.ts
supabase/migrations/
.env.example
.github/workflows/ci.yml                     ← added in Phase 1, not Phase 5
```

### [v3] 1-I. Compliance Foundations (must exist before ANY real child data — NOT deferrable to Phase 5)

These are contract- or schema-level decisions that cannot be retrofitted or "stated in writing" away. They are cheap now and ruinous later.

- **Data roles & lawful basis (one-page decision):** the **tenant (school/club) is the data Controller; the platform is a Processor** acting on its instructions. Lawful basis = performance of the contract with the school (+ the school's own basis for the child data). This determines everything downstream.
- **Customer-facing DPA template (Art. 28):** scope, sub-processors with flow-down, security measures, breach-notification timelines, assistance with data-subject requests, deletion/return on termination. **A signed DPA with each tenant is a hard prerequisite to onboarding the first paying school** — school procurement will demand it day one. (This is *separate from* confirming DPAs with your upstream vendors.)
- **DPIA skeleton (living doc):** large-scale processing of children's data is a near-automatic DPIA trigger (UK/EU GDPR Art. 35 + the UK Children's Code). Capture data flows, subject categories (children, parents), purposes, lawful basis, sub-processors + regions, risks (cross-tenant leakage, public-repo secret exposure, OTP account takeover) and mitigations.
- **Erasure/retention schema split + audit_log** — already specified in §1-G; called out here because they are compliance gates, not features.
- **Region / scope go-no-go:** Supabase region is a one-way door. **Decide explicitly:** v1 is **UK/EU-only** (state US schools are out of scope, EU/UK region intentional) — *or* if US schools are in scope, plan a per-region project + **FERPA/COPPA** contract addenda. Do not leave region as an unqualified single choice.
- **Sub-processor register + residency:** Stripe, Resend, Upstash, Vercel all process PII — record each, its region, and that transfers are covered.

### Phase 1 Verification
- `npm run dev` starts (Next 16), no TS errors
- `supabase start` + migrations apply locally; all tables + RLS visible
- **[v3] Invitation with a valid token + OTP → profile bound; wrong/absent token → no profile (token verified)**
- **[v3] Admin-created student with `parent_email` → linked to parent on first login**
- `src/types/database.ts` committed and exports `Database`
- **[v3] `.gitignore` excludes `.claude/settings.local.json` (`git status --ignored` confirms); gitleaks baseline over history is clean; CI has least-privilege perms + SHA-pinned actions**
- CI (lint + tsc + gitleaks + audit) green on first push
- **[v3] Compliance Foundations artifacts exist** (roles decision, DPA template, DPIA skeleton, retention schedule, region go/no-go)

---

## Phase 2 — Auth, Onboarding & Manager Dashboard

### OTP flow — pick ONE (resolves the dead-callback contradiction)
**Decision: pure 6-digit code flow** (matches the product brief).
1. `LoginForm` → `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })` → redirect to `/verify?email=...`. **[v3] The invite-acceptance entry (`/accept-invite`) passes `options.data.invite_token` so the trigger can verify it** (plain login from `/login` carries no token → binds nothing → "ask your school for an invite", which is correct for an uninvited email).
2. `OtpForm` → `supabase.auth.verifyOtp({ email, token, type: 'email' })` → on success read `profiles.role`+`tenant_id`+`status` → if `status='disabled'` or **no profile row**, sign out and show "no access / ask your school for an invite"; else redirect (system_admin→/admin, tenant_admin→/{slug}/manage, parent→/{slug}/portal).
3. **Edit the Supabase email template** (Auth → Email Templates → Magic Link/OTP) to include the 6-digit token `{{ .Token }}` and tenant-neutral branding. Without this the email only contains a link, and the code flow has nothing to enter.
4. `exchangeCodeForSession` and `/api/auth/callback` are **NOT created** — a pure code flow returns the session in-page from `verifyOtp`; there is no redirect callback. (If a magic-link fallback is ever added, introduce the callback route then.)

### Invitation/onboarding (the spine)
- `POST /api/invitations` (admin only): validates the caller's role server-side. **[v3] `tenant_id` is ALWAYS derived from the authenticated caller's profile — NEVER from the request body** (body carries only `email` + `role`). A tenant_admin may create only `parent`/`tenant_admin` invites **in their own tenant**; only system_admin may create `system_admin` invites. **Prefer the user-scoped client for the INSERT** so the `invitations_write` RLS WITH CHECK is a second line of defense (it requires `tenant_id = current_tenant_id()` for tenant_admin); use the admin client only for the Resend send. Inserts a row with an unguessable `token`, emails `/accept-invite?token=...&email=...`. **Writes an `audit_log` entry.**
- `/accept-invite` page: reads `token`+`email` from the URL, prefills email, triggers the OTP send **carrying the token**: `signInWithOtp({ email, options: { data: { invite_token: token } } })`. On first `verifyOtp`, the `003` trigger matches **token+email on one row** and binds tenant+role (and links pre-created students). **[v3] The token is the authorization proof — see 003.**
- Admin "Invite parent" UI creates the `students` rows with `parent_email` set; the `003` trigger links `parent_id` on the parent's first login (no separate resolve step needed).

### Rate limiting (Upstash) — abuse + cost control
`lib/ratelimit.ts`: `@upstash/ratelimit` sliding window.
- **OTP send path:** per-IP and per-email limits (e.g. 5/hour/email, 20/hour/IP).
- **[v3] OTP VERIFY path (was missing — a 6-digit code is a 1,000,000-key space):** throttle failed `verifyOtp` attempts per email+IP (e.g. **max 5 failures → invalidate the code / force a fresh send + exponential backoff**). Without this, an attacker who triggers one send can brute-force the code online — and OTP is the *only* auth factor.
- **[v3] Shorten Supabase OTP expiry to 5–10 min** (Auth settings) to cut the brute-force window; consider 8-digit codes if supported.
- **Raise Supabase's default Auth email rate limit** after enabling custom SMTP (default is a few/hour and silently throttles real usage). Add **Turnstile/hCaptcha** on the login form (Supabase supports it) for abuse/cost control on a public repo.

### Key patterns
- `lib/supabase/server.ts`: `createServerClient` with async `cookies()` (Next 16), `getAll`/`setAll` (verified current API).
- `middleware.ts`: refresh session + guard `/admin`, `/manage`, `/portal`; **exclude `/api/stripe/webhook`** from the matcher (raw body); also exclude static assets.
- `(tenant)/[slug]/layout.tsx`: resolve tenant by slug AND **assert the authenticated user's `tenant_id` matches** (or is system_admin) and **`status='active'`** — `notFound()`/redirect otherwise. **[v3] This is defense-in-depth and uses the user-scoped (RLS-respecting) client — it does NOT replace RLS; RLS remains the true boundary.** Treat a missing/disabled profile as no-access (fail closed explicitly, not by NULL coincidence).

### Phase 2 files
`middleware.ts`; `lib/supabase/{browser,server,admin}.ts`; `lib/ratelimit.ts`; `lib/utils.ts`; `(auth)/login`, `verify`, `accept-invite` pages; `auth/{LoginForm,OtpForm}.tsx`; `api/invitations/route.ts`; `app/layout.tsx` (QueryProvider, ThemeProvider, Toaster); `providers/QueryProvider.tsx`; `(dashboard)/admin/{page,tenants,tenants/[id]}`; admin invite UI; `dashboard/{Sidebar,TopNav}.tsx` (TopNav includes **logout** = `supabase.auth.signOut()` + redirect); `error.tsx`, `not-found.tsx`, `loading.tsx`.

### Phase 2 Verification
- Admin invites an email → invite arrives via Resend → that user accepts via token+OTP → lands in the correct tenant with the correct role
- Uninvited email logging in (no token) → sees "not invited", no access; **[v3] a wrong/absent `invite_token` → no profile created**
- OTP **send** is rate-limited (6th request/hour blocked); **[v3] OTP verify is throttled** (Nth failed attempt invalidates the code); Supabase Auth rate limit raised
- Logout ends the session; protected routes redirect to `/login`; **[v3] a `disabled` user loses access at next refresh**
- **[v3]** A tenant_admin **cannot** create an invitation for another `tenant_id`, nor a `system_admin` invite
- `system_admin` sees the tenant list and can invite a `tenant_admin`

---

## Phase 3 — Parent Portal & Tenant Admin CRUD

### Tenant resolution
`(tenant)/[slug]/layout.tsx` (Server Component): fetch tenant by `domain_slug`; `notFound()` if missing; assert caller membership (Phase 2); provide tenant via context.

### Parent portal tabs
| Tab | Data | Interaction |
|---|---|---|
| Payments | `invoices` ⨝ `students` for this parent (pending + history) | PayAllButton → Stripe Checkout |
| Calendar | `events` | **Client Component** wrapping `react-big-calendar` (month nav needs client state); color-coded by `event_type` |
| Scheduling | available `appointment_slots` **filtered to the child's teacher** (via `teachers.class_name`/join), availability derived (no non-cancelled appointment) | SlotPicker → `POST /api/appointments/book` |
| Notices | `announcements` + this parent's acks | "Noted" → `upsert announcement_acknowledgements` (parent_id = auth.uid()) |

### Tenant Admin manage pages
`teachers/` (incl. class assignment), `students/` (create with `parent_email`; trigger links on parent's first login), `invoices/` (create per student, mark overdue), `calendar/` (events), `slots/` (create slots, timezone-aware), `announcements/` (create/edit, mark urgent), `invitations/` (invite/re-invite parents, see pending).

### [v3] Stored-XSS / output safety (announcements are tenant_admin-authored, rendered to all parents)
A malicious/compromised tenant_admin's announcement runs in every parent's authenticated session if rendered unsafely (cookie/session theft, fake payment redirects).
- Render announcement content as **escaped text** by default. If rich text is required, **sanitize server-side with an allowlist** (`sanitize-html`/DOMPurify) **before storage AND before render**; **never** `dangerouslySetInnerHTML` with raw tenant input.
- **Acknowledgement upsert** must set `parent_id = auth.uid()` server-side (never from client) — the immutable INSERT-only RLS already blocks editing others' acks, but the value must not be client-trusted.

### Phase 3 Verification
- Parent sees only own children's invoices; Tenant B's slug → empty/`notFound()`
- Calendar navigates months client-side, color-coded
- Scheduling only shows the child's teacher's slots
- "Noted" writes an ack row for the caller only; admin creates student (with `parent_email`) + invites parent → parent sees the child after accepting
- **[v3]** An announcement containing `<script>`/`<img onerror>` is neutralised (escaped/sanitised) in the parent view

---

## Phase 4 — Payment Integration & Scheduling (secured)

### Stripe Checkout — server-authoritative
`POST /api/stripe/checkout` — **uses the admin client** (RLS-bypassing), because step 5 writes `stripe_checkout_session_id` back onto invoices and the `invoices` RLS forbids parents from writing invoices. Because the admin client bypasses RLS, the ownership filter is **mandatory explicit code**, not RLS:
1. `getUser()` (user-scoped server client, just to identify the caller); 401 if none.
2. **Re-fetch invoices via the admin client**, filtered explicitly by `WHERE id = ANY(clientInvoiceIds) AND status = 'pending' AND student_id IN (SELECT id FROM students WHERE parent_id = <caller.id>)`. The client invoice ids are used **only as a filter**; ownership is enforced by the `parent_id = caller.id` join, amounts come from the DB rows. Reject if the result set is empty or smaller than requested (means some ids weren't the caller's → 403/400).
3. **Reject mixed currencies** (all line items in one Checkout Session must share a currency) → 400 with a clear message.
4. Build `line_items` from DB amounts (integer cents) — never from client input.
5. `stripe.checkout.sessions.create(...)`; write the returned `session.id` onto each invoice (`stripe_checkout_session_id`) via the admin client so the webhook reverse-looks-up by session id (no metadata-overflow dependency).
6. Return `{ url }`.

### Stripe webhook — idempotent
`POST /api/stripe/webhook`:
1. Read raw body via `request.text()` (App Router does not auto-parse — confirmed correct, no `bodyParser` config).
2. `stripe.webhooks.constructEvent(body, sig, secret)`; 400 on bad signature.
3. **Idempotency:** `INSERT event.id INTO processed_stripe_events` — if conflict, return 200 (already handled).
4. `checkout.session.completed` → mark invoices `paid` **by `stripe_checkout_session_id = session.id`** (admin client).
5. Also handle `checkout.session.expired` / async-payment failures → leave/return invoice to `pending` and surface a retry (avoid stuck state).
6. (Stretch) `charge.refunded` → flag/revert; or a manual admin "mark refunded".

### Slot booking — atomic, no race, authorized
`POST /api/appointments/book` (admin client, but fully authorized in code):
1. `getUser()`; 401 if none.
2. **Authorize the resource:** verify `student.parent_id = auth.uid()` AND `slot.tenant_id = caller.tenant_id` AND the slot's teacher teaches that student. 403 otherwise. (This is the IDOR fix — the admin client bypasses RLS, so these checks are mandatory.)
3. **Atomic insert:** attempt `INSERT INTO appointments(...)`; rely on the partial unique index. Catch Postgres unique-violation **`23505` → return 409** "slot already booked". No `is_booked` flag, no read-then-write, no manual rollback.

### Stripe local dev
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# copy whsec_... into .env.local
```

### Phase 4 Verification
- Tampering: a parent posting another family's invoice id → that invoice is filtered out (not charged)
- Mixed-currency invoices → clean 400, not a 500
- Pay with `4242…` → webhook (idempotent; re-delivery is a no-op 200) → invoice `paid`
- Booking another family's `student_id` → 403; two parents racing one slot → one 200, one 409

---

## Phase 5 — Testing, QA & Launch

### Testing (write alongside the code, not all deferred)
- RLS tests when `002` lands (supabase-js with two tenant JWTs, or pgTAP) — prove isolation
- Webhook signature + idempotency test when the webhook lands
- Double-booking concurrency test when booking lands
- Unit: zod schemas, `cn()`, currency/timezone helpers
- E2E (Playwright): invite→OTP login, payments+checkout, scheduling+double-booking

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom
npm install -D @playwright/test && npx playwright install chromium
```
Configure vitest `passWithNoTests` only as an interim; remove once tests exist (so green ≠ empty).

### Security checklist before deploy (automated where possible)
- [ ] **gitleaks** CI job + GitHub Push Protection green (replaces the manual grep); no secret in history
- [ ] `grep -r "SERVICE_ROLE_KEY"` → no client component; `STRIPE_WEBHOOK_SECRET` only in the webhook route
- [ ] RLS enabled on all tables; system_admin short-circuit present in every tenant policy
- [ ] Every admin-client route re-authenticates AND authorizes the resource (checkout, booking, invitations, webhook)
- [ ] `.env.local` + `.claude/settings.local.json` absent from `git status`; webhook excluded from middleware matcher
- [ ] **[v3] OTP verify throttling** active (Nth failed attempt invalidates code); OTP expiry ≤10 min
- [ ] **[v3] Security headers** present: strict CSP (allowlist Stripe.js + Supabase origins; no `unsafe-inline` scripts), `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, HSTS — set via `next.config` `headers()` or middleware
- [ ] **[v3] Announcement content** sanitised/escaped (no raw `dangerouslySetInnerHTML`)
- [ ] **[v3] Per-action rate limits** on checkout + booking (anti-spam / slot-griefing); Stripe success/cancel URLs allowlisted (no open redirect)
- [ ] **[v3] CI** has `permissions: contents: read` + SHA-pinned actions; `npm audit` clean (high+); lockfile committed
- [ ] **[v3] audit_log** receiving entries for invites/role-changes/exports/erasure

### Compliance — launch polish (the schema/contract prerequisites live in Phase 1, see "Compliance Foundations")
- Privacy policy + ToS pages; cookie/consent notice
- **Data-export (DSAR) endpoint** — scoped to the caller's own data (parent) or tenant_admin's tenant; treat as a sensitive surface (audit-logged, rate-limited, no IDOR)
- **Incident-response runbook** rehearsed; breach-notification path to the controller (Art. 33/34 clocks)
- Confirm **upstream sub-processor DPAs** (Supabase, Stripe, Resend, Vercel, Upstash) and their processing regions
- DPIA finalised from its Phase 1 skeleton

### Production promotion (gated — first prod DB contact)
```bash
npx supabase link --project-ref <PROD_ref>
npx supabase db diff           # review
# backup prod, then:
npx supabase db push
```
Set Supabase Auth **Site URL** only (pure code flow needs no redirect/callback URL); ensure the OTP email template (`{{ .Token }}`) is configured in the prod project. Deploy: `vercel --prod`; add all `.env.example` keys as Vercel env vars (preview vs production scopes; dev project for preview). Stripe Dashboard → Webhooks → add prod endpoint for `checkout.session.completed` (+ `checkout.session.expired`); copy `whsec_…` to Vercel.

### CI (`.github/workflows/ci.yml`, added in Phase 1)
`permissions: contents: read` (top-level) + SHA-pinned actions. Jobs: lint + `tsc --noEmit` + `vitest run` + **gitleaks** + `npm audit --audit-level=high` + a **typegen-staleness guard**. **[v3] The typegen guard runs `supabase start` (local Postgres in the runner) and `gen types --local`, then `git diff --exit-code src/types/database.ts` — hermetic, so NO database credential ever exists in CI** (avoids leaking a dev DB token on a public repo). If a remote dev project is ever used, gate that job off fork PRs.

### [v3] Staging tier + email deliverability gate
The plan has local + prod; add a **staging** Supabase project wired to Vercel Preview (Stripe TEST). Before launch, run an **OTP deliverability test**: send to ≥3 real external inboxes (Gmail, Outlook, iCloud) from the *verified* domain → confirm **inbox (not spam)** placement and that `{{ .Token }}` renders. "OTP delivered to external inbox from verified domain" is a **hard gate** (DNS issues found in prod are too late).

### [v3] Observability (otherwise OTP/webhook failures are silent in prod)
- Error tracking (Sentry or Vercel) on route handlers + server components
- Alert on: webhook signature failures, OTP send/verify error spikes, failed-auth bursts (security signal), 5xx rate
- Structured logs for the admin-client routes (never log secrets/PII bodies)

### Phase 5 Verification
- `tsc --noEmit`, `lint`, `vitest run`, `playwright test`, **gitleaks**, **`npm audit`** all pass
- Vercel prod build succeeds; **[v3] OTP reaches a real external inbox (not spam) from the verified domain**
- Webhook processes a real test payment end-to-end (and re-delivery is a no-op)
- **[v3] Security headers present** (verify with an external scanner); **a disabled user loses access** at next refresh

---

## Timeline (re-baselined)

The original 8 weeks is unrealistic. With v3's added security/compliance scope, plan **~14–18 weeks solo** with Claude Code, OR cut scope explicitly (MoSCoW). **[v3] Top 3 schedule risks (critical path):** (1) the onboarding spine + Phase 0 decisions (token/student-link) — front-loaded deliberately; (2) Resend domain verification + OTP deliverability (external dependency, start day 1); (3) compliance artifacts gating the first school sale (DPA/DPIA). Non-functionals (security headers, audit log, retention) are easy to skip under pressure and are the worst to skip here — keep them in Must.
- **Must (v1):** Phase 0 skeleton (incl. token + student-link + revocation), auth+onboarding, Payments, Announcements (sanitised), Compliance Foundations, secret-scanning/CI, audit_log
- **Should:** Calendar, Tenant Admin CRUD breadth, observability/alerting
- **Could / v1.1:** Scheduling, refunds, transactional email beyond OTP
- **Won't (v1):** US schools / FERPA-COPPA (UK/EU-only — state explicitly), multi-tenant-per-user membership (document the one-tenant-per-user limit)

**[v3] Single most important process change:** treat the **Phase 0 exit checklist as a binding contract** — it forces the three previously-latent decisions (token verification, student linking, revocation) to be resolved on a thin slice before any CRUD is built, which is where they are cheapest to get right.

---

## Critical files (highest risk)

| File | Why critical |
|---|---|
| `supabase/migrations/003_onboarding.sql` | The spine — binds users to tenants **by token+email [v3]** + links students; wrong → everyone locked out or privilege escalation |
| `supabase/migrations/002_rls_policies.sql` | Multi-tenant isolation; helpers in `private` schema, search_path pinned, system_admin short-circuit; **append-only `audit_log` [v3]** |
| `supabase/migrations/001_initial_schema.sql` | **[v3] Erasure/retention split** (financial records pseudonymised, not cascade-deleted); `students.parent_email`, `profiles.status` |
| `src/app/api/invitations/route.ts` | **[v3] tenant_id server-derived (never from body)** — cross-tenant invite-injection guard; audit-logged |
| `src/app/api/appointments/book/route.ts` | Admin-client → must authorize resource (IDOR fix) + 23505→409 (atomicity) |
| `src/app/api/stripe/checkout/route.ts` | Server-authoritative amounts/ownership/currency (tampering fix) |
| `src/app/api/stripe/webhook/route.ts` | Signature + idempotency + session-id reverse lookup |
| `src/middleware.ts` | Session refresh + route guard + **OTP send & verify [v3]** rate-limit + webhook exclusion |
| `next.config.ts` / headers | **[v3] Security headers / CSP** — backstop against stored XSS from tenant content |
| `.gitignore` + `ci.yml` | **[v3] Secret-leak defense** (`.claude/settings.local.json`, gitleaks, push protection, least-priv CI) |
| `src/lib/supabase/server.ts` | Async server client; cookie API must match `@supabase/ssr` |
