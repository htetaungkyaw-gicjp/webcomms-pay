-- ============================================================================
-- 004_seed_first_admin.sql  —  WebComms & Pay
-- The very first platform admin, seeded as a tenant-less invitation (NOT a
-- direct auth.users insert — those require hashing Supabase's internal fields
-- and are fragile). tenant_id is NULL because system_admin has no tenant.
--
-- The admin then logs in normally at /login → OTP → the 003 trigger finds this
-- invitation, creates a profiles row (role=system_admin, tenant_id=NULL) and
-- marks the invite accepted. No direct auth.users manipulation.
--
-- The token here is a FIXED placeholder for LOCAL DEV ONLY so the bootstrap is
-- repeatable; in a real environment replace the email and use a random token.
-- Idempotent.
-- ============================================================================

INSERT INTO public.invitations (email, role, tenant_id, token, expires_at)
VALUES ('admin@webcommspay.example', 'system_admin', NULL,
        'seed-system-admin-token-local-dev-only',
        now() + interval '30 days')
ON CONFLICT DO NOTHING;
