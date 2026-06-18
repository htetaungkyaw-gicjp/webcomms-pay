-- ============================================================================
-- seed.sql  —  WebComms & Pay  (Phase 0 fixtures, LOCAL DEV ONLY)
-- Runs automatically on `supabase start` / `supabase db reset`.
--
-- Per PLAN.md Phase 0 step 3: bootstrap via the REAL invitation path, not direct
-- auth.users seeding. We seed only: two tenants, an invitations row for one
-- tenant_admin + one parent per tenant, and (for Tenant A's parent) a
-- pre-created student with parent_email set — to prove the 003 trigger links it.
-- The system_admin invitation is seeded by migration 004.
--
-- Each principal becomes a real user only when they log in via OTP carrying
-- their token; the 003 trigger then binds them. NO auth.users rows are seeded.
--
-- Tokens are FIXED here for repeatable local testing — never do this in prod.
-- ============================================================================

-- Fixed UUIDs so re-running / cross-referencing is stable.
INSERT INTO public.tenants (id, name, domain_slug, timezone) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Aurora Primary School', 'aurora', 'Asia/Singapore'),
  ('22222222-2222-2222-2222-222222222222', 'Brighton Sports Club',  'brighton', 'Asia/Singapore')
ON CONFLICT (id) DO NOTHING;

-- Invitations (token = the authorization proof carried through OTP).
INSERT INTO public.invitations (tenant_id, email, role, token, expires_at) VALUES
  -- Tenant A (Aurora)
  ('11111111-1111-1111-1111-111111111111', 'admin-a@aurora.example',  'tenant_admin', 'token-aurora-admin',   now() + interval '30 days'),
  ('11111111-1111-1111-1111-111111111111', 'parent-a@aurora.example', 'parent',       'token-aurora-parent',  now() + interval '30 days'),
  -- Tenant B (Brighton)
  ('22222222-2222-2222-2222-222222222222', 'admin-b@brighton.example',  'tenant_admin', 'token-brighton-admin',  now() + interval '30 days'),
  ('22222222-2222-2222-2222-222222222222', 'parent-b@brighton.example', 'parent',       'token-brighton-parent', now() + interval '30 days')
ON CONFLICT (token) DO NOTHING;

-- Pre-created student for Tenant A's parent (parent has NO account yet).
-- parent_id stays NULL until parent-a@aurora.example logs in; the 003 trigger
-- then sets parent_id by matching parent_email + tenant_id.
INSERT INTO public.students (id, tenant_id, parent_id, parent_email, full_name, class_name) VALUES
  ('aaaa1111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111',
   NULL,
   'parent-a@aurora.example',
   'Amelia Tan',
   'Primary 3B')
ON CONFLICT (id) DO NOTHING;

-- An invoice for that student (server-authoritative amount; SGD, AP region).
-- Parent A should see exactly this one invoice after onboarding.
INSERT INTO public.invoices (id, tenant_id, student_id, description, amount_cents, currency, status) VALUES
  ('bbbb1111-1111-1111-1111-111111111111',
   '11111111-1111-1111-1111-111111111111',
   'aaaa1111-1111-1111-1111-111111111111',
   'Term 1 tuition',
   12500,
   'sgd',
   'pending')
ON CONFLICT (id) DO NOTHING;

-- A Tenant B invoice/student that Parent A must NEVER see (isolation proof).
INSERT INTO public.students (id, tenant_id, parent_id, parent_email, full_name, class_name) VALUES
  ('aaaa2222-2222-2222-2222-222222222222',
   '22222222-2222-2222-2222-222222222222',
   NULL,
   'parent-b@brighton.example',
   'Ben Lim',
   'Squad U12')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.invoices (id, tenant_id, student_id, description, amount_cents, currency, status) VALUES
  ('bbbb2222-2222-2222-2222-222222222222',
   '22222222-2222-2222-2222-222222222222',
   'aaaa2222-2222-2222-2222-222222222222',
   'Monthly membership',
   8000,
   'sgd',
   'pending')
ON CONFLICT (id) DO NOTHING;
