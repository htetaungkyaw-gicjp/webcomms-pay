-- ============================================================================
-- 007_stripe_connect.sql  —  WebComms & Pay
-- Per-tenant Stripe payouts via Stripe Connect (Phase 6, see
-- .claude/plan/PHASE-6-CONNECT.md).
--
-- Adds connected-account state to `tenants`. Each school/club gets its own
-- Stripe connected account (`acct_...`); parent payments are routed to it via
-- destination charges (transfer_data.destination) at checkout. These columns
-- are written ONLY by the admin (service-role) client in the Connect routes and
-- the `account.updated` webhook branch — NEVER by a tenant_admin through the
-- API. They are covered by the existing `tenants` RLS (tenants_write =
-- system_admin only), so no new policy is required.
--
-- Additive + nullable: existing tenants are unaffected and simply cannot accept
-- payments until onboarded (stripe_charges_enabled stays false → checkout 409s).
-- ============================================================================

ALTER TABLE public.tenants
  -- The connected account id (acct_...). NULL until onboarding starts. UNIQUE so
  -- one Stripe account maps to at most one tenant.
  ADD COLUMN IF NOT EXISTS stripe_account_id        TEXT UNIQUE,
  -- Mirror of Stripe's Account.charges_enabled — THE CHECKOUT GATE. Checkout
  -- fails closed (409) unless this is true.
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled   BOOLEAN NOT NULL DEFAULT false,
  -- Mirror of Stripe's Account.payouts_enabled — informational for the manage UI.
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled   BOOLEAN NOT NULL DEFAULT false,
  -- Mirror of Stripe's Account.details_submitted — distinguishes "never started"
  -- from "submitted, awaiting Stripe review".
  ADD COLUMN IF NOT EXISTS stripe_details_submitted BOOLEAN NOT NULL DEFAULT false;

-- Webhook reverse-lookup: account.updated matches a tenant by stripe_account_id.
-- (TEXT UNIQUE already creates a unique index, which serves this lookup; the
-- explicit index name documents intent and is a no-op if the unique index
-- already covers it.)
CREATE INDEX IF NOT EXISTS tenants_stripe_account_idx
  ON public.tenants (stripe_account_id);
