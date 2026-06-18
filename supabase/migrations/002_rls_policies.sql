-- ============================================================================
-- 002_rls_policies.sql  —  WebComms & Pay
-- Row-Level Security: the TRUE tenant-isolation boundary (app-layer checks are
-- only defense-in-depth). PLAN.md §1-G.
--
-- Invariants enforced here:
--   * Helpers live in a PRIVATE (non-API-exposed) schema — NOT auth, NOT public.
--   * Helpers are STABLE SECURITY DEFINER with search_path pinned EMPTY; every
--     reference inside is fully-qualified.
--   * Every tenant-scoped policy SHORT-CIRCUITS system_admin FIRST (system_admin
--     has tenant_id = NULL; without the leading OR they would be locked out).
--   * Helper calls are wrapped in (SELECT ...) so the planner evaluates them
--     once per query, not once per row.
--   * Fail closed: a disabled/missing profile yields NULL role+tenant → no match.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS private;
-- authenticated needs USAGE on `private` to invoke the helpers during policy
-- evaluation (the schema is not API-exposed, so this is not a data-leak path).
GRANT USAGE ON SCHEMA private TO authenticated;

-- ---------------------------------------------------------------------------
-- Base table privileges. RLS is the row-level boundary, but the API roles still
-- need table-level GRANTs to reach the rows RLS would let them see. anon and
-- authenticated are gated by RLS; service_role BYPASSES RLS (admin client) and
-- needs full DML for the Route Handlers (checkout/webhook). These grants are
-- applied AFTER the tables exist (see grant block at the end of this file).
-- ---------------------------------------------------------------------------

-- current_tenant_id(): the caller's tenant, or NULL (system_admin / no profile).
-- A 'disabled' profile returns NULL so it matches no tenant row (fail closed).
CREATE OR REPLACE FUNCTION private.current_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT tenant_id FROM public.profiles
  WHERE id = (SELECT auth.uid()) AND status = 'active'
$$;

-- current_role(): the caller's role, or NULL if no active profile (fail closed).
CREATE OR REPLACE FUNCTION private.current_role()
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT role FROM public.profiles
  WHERE id = (SELECT auth.uid()) AND status = 'active'
$$;

-- NOTE on helper EXECUTE: the policies below call these helpers AS the calling
-- role, so `authenticated` MUST retain EXECUTE (SECURITY DEFINER governs the
-- rights the function runs WITH, not who may invoke it). We do NOT revoke from
-- authenticated. Safety comes from the helpers living in the `private` schema,
-- which PostgREST does not expose over the API — they cannot be called as RPCs.
-- We only revoke from anon (never authenticated during policy evaluation).
REVOKE EXECUTE ON FUNCTION private.current_tenant_id() FROM anon;
REVOKE EXECUTE ON FUNCTION private.current_role()      FROM anon;

-- Enable RLS on every table.
ALTER TABLE public.tenants                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;
-- processed_stripe_events: RLS on, NO policies → only the service-role client
-- (which bypasses RLS) can read/write it. Intentional.

-- ---------------------------------------------------------------------------
-- tenants: members SELECT own + system_admin all; INSERT/UPDATE system_admin only.
-- ---------------------------------------------------------------------------
CREATE POLICY "tenants_select" ON public.tenants FOR SELECT USING (
  (SELECT private.current_role()) = 'system_admin'
  OR id = (SELECT private.current_tenant_id())
);
CREATE POLICY "tenants_write" ON public.tenants FOR ALL USING (
  (SELECT private.current_role()) = 'system_admin'
) WITH CHECK (
  (SELECT private.current_role()) = 'system_admin'
);

-- ---------------------------------------------------------------------------
-- profiles: own row always; tenant_admin/system_admin see their tenant;
-- INSERT only self (the 003 trigger runs as SECURITY DEFINER and bypasses this).
-- ---------------------------------------------------------------------------
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (
  id = (SELECT auth.uid())
  OR (SELECT private.current_role()) = 'system_admin'
  OR (tenant_id = (SELECT private.current_tenant_id())
      AND (SELECT private.current_role()) = 'tenant_admin')
);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT WITH CHECK (
  id = (SELECT auth.uid())
);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE USING (
  id = (SELECT auth.uid())
  OR (SELECT private.current_role()) = 'system_admin'
) WITH CHECK (
  id = (SELECT auth.uid())
  OR (SELECT private.current_role()) = 'system_admin'
);

-- ---------------------------------------------------------------------------
-- invitations: explicit form (NOT the bare template). The leading system_admin
-- OR must survive in BOTH USING and WITH CHECK, else a system_admin (tenant NULL)
-- cannot insert a tenant-less system_admin invite. tenant_admin may invite only
-- into their own tenant and NEVER a system_admin.
-- SELECT-by-token at accept time is done server-side via the service-role client.
-- ---------------------------------------------------------------------------
CREATE POLICY "invitations_select" ON public.invitations FOR SELECT USING (
  (SELECT private.current_role()) = 'system_admin'
  OR (tenant_id = (SELECT private.current_tenant_id())
      AND (SELECT private.current_role()) = 'tenant_admin')
);
CREATE POLICY "invitations_write" ON public.invitations FOR ALL
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

-- ---------------------------------------------------------------------------
-- students: parent sees own children; tenant_admin/system_admin see tenant;
-- writes tenant_admin (within tenant) / system_admin (anywhere).
-- ---------------------------------------------------------------------------
CREATE POLICY "students_select" ON public.students FOR SELECT USING (
  (SELECT private.current_role()) = 'system_admin'
  -- Parent branch is gated on an ACTIVE parent profile: current_role() returns
  -- NULL for a disabled/missing profile, so a disabled parent matches nothing
  -- (the auth.uid() ownership link alone would otherwise survive revocation).
  OR ((SELECT private.current_role()) = 'parent' AND parent_id = (SELECT auth.uid()))
  OR (tenant_id = (SELECT private.current_tenant_id())
      AND (SELECT private.current_role()) = 'tenant_admin')
);
CREATE POLICY "students_write" ON public.students FOR ALL
USING (
  (SELECT private.current_role()) = 'system_admin'
  OR (tenant_id = (SELECT private.current_tenant_id())
      AND (SELECT private.current_role()) = 'tenant_admin')
)
WITH CHECK (
  (SELECT private.current_role()) = 'system_admin'
  OR (tenant_id = (SELECT private.current_tenant_id())
      AND (SELECT private.current_role()) = 'tenant_admin')
);

-- ---------------------------------------------------------------------------
-- invoices: parent sees only invoices for their OWN students (subselect);
-- writes tenant_admin / system_admin.
-- ---------------------------------------------------------------------------
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT USING (
  (SELECT private.current_role()) = 'system_admin'
  OR (tenant_id = (SELECT private.current_tenant_id())
      AND (SELECT private.current_role()) = 'tenant_admin')
  -- Parent branch gated on an ACTIVE parent profile (see students_select): a
  -- disabled parent's auth.uid() link to the student must NOT survive revocation.
  OR ((SELECT private.current_role()) = 'parent'
      AND student_id IN (
        SELECT id FROM public.students WHERE parent_id = (SELECT auth.uid())
      ))
);
CREATE POLICY "invoices_write" ON public.invoices FOR ALL
USING (
  (SELECT private.current_role()) = 'system_admin'
  OR (tenant_id = (SELECT private.current_tenant_id())
      AND (SELECT private.current_role()) = 'tenant_admin')
)
WITH CHECK (
  (SELECT private.current_role()) = 'system_admin'
  OR (tenant_id = (SELECT private.current_tenant_id())
      AND (SELECT private.current_role()) = 'tenant_admin')
);

-- ---------------------------------------------------------------------------
-- Base table GRANTs (RLS still governs which ROWS anon/authenticated reach).
--   * authenticated: DML on the app tables, row-gated by the policies above.
--   * service_role:  full DML; BYPASSES RLS (admin-client Route Handlers must
--                    re-authorize in code).
--   * anon:          no table access — the OTP flow uses auth endpoints, not
--                    table reads, so anon is granted nothing here (fail closed).
-- processed_stripe_events is intentionally service_role-only.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.tenants, public.profiles, public.invitations,
  public.students, public.invoices
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
