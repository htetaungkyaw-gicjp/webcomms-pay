-- ============================================================================
-- 001_initial_schema.sql  —  WebComms & Pay
-- Phase 0 walking-skeleton subset of the full schema (PLAN.md §1-G).
-- Tables: tenants, profiles, invitations, students, invoices.
-- The remaining tables (events, teachers, appointment_slots, appointments,
-- announcements, announcement_acknowledgements, processed_stripe_events for the
-- webhook, audit_log) are added in later phases; processed_stripe_events IS
-- included here because the Phase 0 webhook needs idempotency.
--
-- Design decisions baked in now because they cannot be retrofitted:
--   * invitations.tenant_id and profiles.tenant_id are NULLABLE (system_admin
--     belongs to no tenant). CHECK enforces "tenant_id NULL only for system_admin".
--   * students.parent_email lets an admin pre-create a child before the parent
--     has an account; the 003 trigger links parent_id on first login.
--   * profiles.status (active|disabled) enables fail-closed revocation.
--   * invoices carry stripe_checkout_session_id for the webhook reverse-lookup,
--     and are RETAINED (not cascade-deleted) on erasure — see §1-G. In Phase 0
--     we only model the columns; the erasure/pseudonymise routine lands later.
-- ============================================================================

-- --- Enums --------------------------------------------------------------------
CREATE TYPE public.user_role AS ENUM ('system_admin', 'tenant_admin', 'parent');
CREATE TYPE public.profile_status AS ENUM ('active', 'disabled');
CREATE TYPE public.invoice_status AS ENUM ('pending', 'paid', 'void');

-- --- tenants ------------------------------------------------------------------
CREATE TABLE public.tenants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  domain_slug  TEXT NOT NULL UNIQUE,
  timezone     TEXT NOT NULL DEFAULT 'Asia/Singapore', -- IANA tz; AP region (see PLAN region decision)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- --- profiles -----------------------------------------------------------------
-- id == auth.users.id. tenant_id NULL only for system_admin.
-- email is a denormalised cache of auth.users.email (NOT a source of truth).
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL DEFAULT '',
  role        public.user_role NOT NULL,
  status      public.profile_status NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_tenant_required_for_non_sysadmin
    CHECK (tenant_id IS NOT NULL OR role = 'system_admin')
);
CREATE INDEX profiles_tenant_idx ON public.profiles (tenant_id);

-- --- invitations  (the onboarding spine) -------------------------------------
-- tenant_id NULLABLE: a system_admin invitation belongs to no tenant.
-- token is the unguessable authorization proof; single-use via accepted_at.
CREATE TABLE public.invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  role         public.user_role NOT NULL,
  token        TEXT NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  accepted_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invitations_tenant_required_for_non_sysadmin
    CHECK (tenant_id IS NOT NULL OR role = 'system_admin')
);
CREATE INDEX invitations_email_idx ON public.invitations (email);
CREATE INDEX invitations_tenant_idx ON public.invitations (tenant_id);

-- --- students -----------------------------------------------------------------
-- parent_email: admin sets this before the parent has an account; the 003
-- trigger fills parent_id on the parent's first login (chicken/egg fix).
CREATE TABLE public.students (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  parent_email  TEXT,
  full_name     TEXT NOT NULL,
  class_name    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX students_tenant_idx ON public.students (tenant_id);
CREATE INDEX students_parent_idx ON public.students (parent_id);
CREATE INDEX students_parent_email_idx ON public.students (parent_email);

-- --- invoices -----------------------------------------------------------------
-- amount_cents is the server-authoritative source of truth for Checkout.
-- student_id is ON DELETE SET NULL: invoices are RETAINED & pseudonymised on
-- erasure (statutory financial retention), never cascade-deleted (§1-G).
CREATE TABLE public.invoices (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id                  UUID REFERENCES public.students(id) ON DELETE SET NULL,
  description                 TEXT NOT NULL DEFAULT '',
  amount_cents                INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency                    TEXT NOT NULL DEFAULT 'sgd' CHECK (char_length(currency) = 3),
  status                      public.invoice_status NOT NULL DEFAULT 'pending',
  stripe_checkout_session_id  TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at                     TIMESTAMPTZ
);
CREATE INDEX invoices_tenant_idx ON public.invoices (tenant_id);
CREATE INDEX invoices_student_idx ON public.invoices (student_id);
CREATE INDEX invoices_session_idx ON public.invoices (stripe_checkout_session_id);

-- --- processed_stripe_events  (webhook idempotency) --------------------------
-- No RLS policies (below) → only the service-role client (webhook) can touch it.
CREATE TABLE public.processed_stripe_events (
  event_id      TEXT PRIMARY KEY,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
