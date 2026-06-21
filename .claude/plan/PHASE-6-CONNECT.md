# Phase 6 — Stripe Connect (per-tenant payouts)

> **Draft contract, written in PLAN.md's format for review before merge into PLAN.md proper.**
> Extends the Phase 4 payment leg. Today there is a single platform Stripe account, so all
> parent payments settle to the platform's own bank. This phase gives **each tenant
> (school/club) its own connected Stripe account** and routes each parent payment to the
> correct one, so the platform never holds the school's funds beyond settlement.

## Decision record (resolve before building)

- **Charge type: destination charges** (`payment_intent_data.transfer_data.destination`), NOT
  direct charges. Rationale: the charge is created on the **platform** account, so the
  `checkout.session.*` events still arrive on the platform webhook with the **same** signing
  secret — the Phase 4 webhook reverse-lookup by `stripe_checkout_session_id` keeps working
  unchanged. Direct charges would deliver those events on the connected account against a
  separate **Connect** webhook secret; avoid that complexity for v1.
- **Account type: Express.** Stripe-hosted onboarding + dashboard, least integration burden for
  non-payment-expert schools. (`standard` = school owns a full Stripe account; revisit if a
  tenant demands it.)
- **Platform fee:** `application_fee_amount` (integer cents) on each PaymentIntent = the
  platform's cut. **Open product decision:** does the school or the platform absorb Stripe's
  ~processing fee? Default v1 = platform fee `0` (no take rate) until pricing is decided; the
  column exists so turning it on is a config change, not a migration.
- **`tenant_id` is derived from the owned invoices, never the request body** — same invariant as
  checkout. The connected account is looked up by the invoices' `tenant_id` after ownership is
  proven.
- **Region caveat (unresolved, inherits Phase 1-I):** Stripe Connect availability + payout rules
  depend on the **school's** country; default currency is `sgd` (Singapore). Confirm Connect is
  enabled for the target market before any real tenant onboards. dev/stg uses Stripe **TEST**
  connected accounts — no real bank details, so verify harnesses extend without live data.

## Schema — `007_stripe_connect.sql`

Add Connect state to `tenants` (additive, nullable — existing tenants are unaffected and simply
cannot accept payments until onboarded):

- `stripe_account_id TEXT UNIQUE` — the connected account (`acct_...`); NULL until onboarding
  starts. UNIQUE so one Stripe account maps to at most one tenant.
- `stripe_charges_enabled BOOLEAN NOT NULL DEFAULT false` — mirror of Stripe's
  `charges_enabled`; the checkout gate. A tenant cannot be charged against until this is true.
- `stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT false` — mirror of Stripe's
  `payouts_enabled`; informational for the manage UI ("payouts pending verification").
- `stripe_details_submitted BOOLEAN NOT NULL DEFAULT false` — mirror of `details_submitted`;
  distinguishes "never started onboarding" from "submitted, awaiting Stripe review".

**RLS:** no new policies needed — these columns live on `tenants`, already covered by
`tenants_select` (members + system_admin read) and `tenants_write` (**system_admin only**). The
connected-account fields are written exclusively by the admin client in the Connect routes /
webhook (service_role bypasses RLS), so tenant_admins cannot self-edit their `charges_enabled`
flag through the API — correct (only Stripe's webhook may flip it). Regenerate
`src/types/database.ts` after applying (`npm run db:types`).

## Route — `POST /api/stripe/connect/onboard` (admin client, authorized in code)

Creates-or-reuses the tenant's connected account and returns a Stripe-hosted onboarding link.
Admin client (writes `stripe_account_id` onto `tenants`, which `tenants_write` forbids for
tenant_admin), so ownership is **explicit code**:

1. `getUser()` (user-scoped client); 401 if none.
2. Per-user rate limit (anti-spam on an external Stripe call) → 429.
3. Resolve the caller's profile (`tenant_id`, `role`) via the admin client. The caller must be a
   `tenant_admin` **of the tenant whose slug is in the body** (or `system_admin`); else 403.
   **`tenant_id` comes from the profile, never the body** — the body's `slug` is only matched
   against the caller's own tenant.
4. Load the tenant. If `stripe_account_id` is NULL → `accounts.create({ type: 'express', ... })`
   and persist it (admin client). If it already exists → reuse (idempotent; never create a
   second account for a tenant).
5. `accountLinks.create({ account, type: 'account_onboarding', refresh_url, return_url })`
   pointing back at `/{slug}/manage/payouts`.
6. Return `{ url }`.

## Route — `POST /api/stripe/connect/refresh` (admin client, authorized in code)

Re-mints an onboarding link when the previous one expired (Stripe account links are
single-use/short-lived). Same auth as onboard (steps 1–3); requires an existing
`stripe_account_id` (409 if the tenant never started onboarding); returns a fresh
`accountLinks.create({ type: 'account_onboarding' })` `{ url }`.

## Checkout — additions to `POST /api/stripe/checkout`

Two changes layered onto the Phase 4 contract (steps renumbered against the existing route):

- **After ownership is proven (existing step 2), before building line_items:** load the tenant
  by `invoices[0].tenant_id` (all owned invoices share a tenant — enforced by RLS + the
  ownership filter). **Gate:** if `stripe_account_id` is NULL OR `stripe_charges_enabled` is
  false → **409** "This organisation hasn't finished payment setup." (fail closed — never start a
  checkout that can't be routed).
- **In `sessions.create` (existing step 5):** add
  `payment_intent_data: { application_fee_amount: <platformFeeCents>, transfer_data: { destination: tenant.stripe_account_id } }`.
  `application_fee_amount` is computed server-side (0 for v1); `destination` is the tenant's
  connected account. Everything else (DB-sourced amounts, session-id writeback) is unchanged.

## Webhook — additions to `POST /api/stripe/webhook`

- **New event `account.updated`** (a Connect account-state event): the `event.data.object` is a
  `Stripe.Account`. Sync `charges_enabled` / `payouts_enabled` / `details_submitted` onto the
  `tenants` row matched by `stripe_account_id = account.id` (admin client). This is what flips
  the checkout gate true once the school finishes Stripe verification. Idempotency is the
  existing `processed_stripe_events` insert — unchanged.
- **`checkout.session.completed` / `expired` / `async_payment_failed` / `charge.refunded`:**
  **unchanged.** Destination charges keep these on the platform account with the same signing
  secret, so the existing reverse-lookup by `stripe_checkout_session_id` still resolves the
  invoices. No Connect webhook secret is introduced.

## Manage UI — `(tenant)/[slug]/manage/payouts/page.tsx`

Server Component for tenant_admins. Reads the tenant's Connect flags (RLS-scoped) and shows one
of: **not started** → "Set up payouts" button → `POST /api/stripe/connect/onboard`; **submitted,
pending** (`details_submitted && !charges_enabled`) → "Verification in progress"; **active**
(`charges_enabled`) → "Payouts active" + a link to the Stripe Express dashboard. A
`refresh_url` return lands here and calls `/connect/refresh` for a new link.

## Files

- `supabase/migrations/007_stripe_connect.sql` (new)
- `src/app/api/stripe/connect/onboard/route.ts` (new)
- `src/app/api/stripe/connect/refresh/route.ts` (new)
- `src/app/api/stripe/checkout/route.ts` (edit — gate + `payment_intent_data`)
- `src/app/api/stripe/webhook/route.ts` (edit — `account.updated`)
- `src/app/(tenant)/[slug]/manage/payouts/page.tsx` (new)
- `src/types/database.ts` (regenerate)
- `scripts/verify-connect.mjs` (new harness — see below)

## Phase 6 Verification (extend the harness suite)

- A tenant with no `stripe_account_id` → parent checkout returns **409**, not a 500, and no
  Stripe session is created.
- `onboard` creates exactly one connected account; a second call **reuses** it (no duplicate
  `acct_`); the returned URL is a Stripe `accountLinks` URL.
- A non-admin (parent) or a tenant_admin of a **different** tenant calling `onboard` → **403**.
- Simulating `account.updated` with `charges_enabled=true` flips `tenants.stripe_charges_enabled`
  true (idempotent on re-delivery); checkout then succeeds and the created session carries
  `transfer_data.destination = acct_...`.
- A test payment to an onboarded connected account → `checkout.session.completed` (platform
  webhook, existing path) → invoice `paid` (proves destination charges don't break Phase 4).
- The connected-account flags are **not** writable by a tenant_admin through the API (only the
  webhook/admin client sets them).
