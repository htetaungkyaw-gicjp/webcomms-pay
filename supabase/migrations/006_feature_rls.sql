-- ============================================================================
-- 006_feature_rls.sql  —  WebComms & Pay
-- RLS for the feature tables added in 005. Follows the SAME invariants as 002:
--   * Reuses private.current_tenant_id() / private.current_role() (already
--     STABLE SECURITY DEFINER, search_path='', fail-closed on disabled/missing).
--   * Every tenant-scoped policy SHORT-CIRCUITS system_admin FIRST.
--   * Helper calls wrapped in (SELECT ...) → evaluated once per query.
--   * Parent branches gate on an ACTIVE parent role (current_role() returns NULL
--     for a disabled/missing profile) so revocation is fail-closed, not reliant
--     on the auth.uid() link alone.
-- ============================================================================

ALTER TABLE public.teachers                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_slots               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_acknowledgements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log                       ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- teachers: tenant members read; tenant_admin (in tenant) / system_admin write.
-- ---------------------------------------------------------------------------
CREATE POLICY "teachers_select" ON public.teachers FOR SELECT USING (
  (SELECT private.current_role()) = 'system_admin'
  OR tenant_id = (SELECT private.current_tenant_id())
);
CREATE POLICY "teachers_write" ON public.teachers FOR ALL
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
-- events: tenant members read; tenant_admin / system_admin write (incl. DELETE
-- via FOR ALL).
-- ---------------------------------------------------------------------------
CREATE POLICY "events_select" ON public.events FOR SELECT USING (
  (SELECT private.current_role()) = 'system_admin'
  OR tenant_id = (SELECT private.current_tenant_id())
);
CREATE POLICY "events_write" ON public.events FOR ALL
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
-- appointment_slots: tenant members read; tenant_admin / system_admin write.
-- ---------------------------------------------------------------------------
CREATE POLICY "slots_select" ON public.appointment_slots FOR SELECT USING (
  (SELECT private.current_role()) = 'system_admin'
  OR tenant_id = (SELECT private.current_tenant_id())
);
CREATE POLICY "slots_write" ON public.appointment_slots FOR ALL
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
-- appointments: parent SELECT/INSERT own (active parent only); tenant_admin
-- SELECT + UPDATE (e.g. confirm/cancel) within tenant; system_admin all.
-- The booking insert normally goes via the admin client (authorized in code);
-- these policies are defense-in-depth for any RLS-respecting path.
-- ---------------------------------------------------------------------------
CREATE POLICY "appointments_select" ON public.appointments FOR SELECT USING (
  (SELECT private.current_role()) = 'system_admin'
  OR ((SELECT private.current_role()) = 'parent' AND parent_id = (SELECT auth.uid()))
  OR (tenant_id = (SELECT private.current_tenant_id())
      AND (SELECT private.current_role()) = 'tenant_admin')
);
CREATE POLICY "appointments_insert" ON public.appointments FOR INSERT WITH CHECK (
  (SELECT private.current_role()) = 'system_admin'
  OR ((SELECT private.current_role()) = 'parent'
      AND parent_id = (SELECT auth.uid())
      AND tenant_id = (SELECT private.current_tenant_id()))
);
CREATE POLICY "appointments_update" ON public.appointments FOR UPDATE
USING (
  (SELECT private.current_role()) = 'system_admin'
  OR ((SELECT private.current_role()) = 'parent' AND parent_id = (SELECT auth.uid()))
  OR (tenant_id = (SELECT private.current_tenant_id())
      AND (SELECT private.current_role()) = 'tenant_admin')
)
WITH CHECK (
  (SELECT private.current_role()) = 'system_admin'
  OR ((SELECT private.current_role()) = 'parent' AND parent_id = (SELECT auth.uid()))
  OR (tenant_id = (SELECT private.current_tenant_id())
      AND (SELECT private.current_role()) = 'tenant_admin')
);

-- ---------------------------------------------------------------------------
-- announcements: tenant members read; tenant_admin / system_admin write.
-- ---------------------------------------------------------------------------
CREATE POLICY "announcements_select" ON public.announcements FOR SELECT USING (
  (SELECT private.current_role()) = 'system_admin'
  OR tenant_id = (SELECT private.current_tenant_id())
);
CREATE POLICY "announcements_write" ON public.announcements FOR ALL
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
-- announcement_acknowledgements: IMMUTABLE.
--   * SELECT if the announcement is in your tenant (members) or system_admin.
--   * INSERT only your OWN ack (parent_id = auth.uid()), and only for an
--     announcement in your tenant.
--   * NO UPDATE / NO DELETE policies → denied by default (an ack is immutable).
-- ---------------------------------------------------------------------------
CREATE POLICY "ack_select" ON public.announcement_acknowledgements FOR SELECT USING (
  (SELECT private.current_role()) = 'system_admin'
  OR EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.id = announcement_id
      AND a.tenant_id = (SELECT private.current_tenant_id())
  )
);
CREATE POLICY "ack_insert_self" ON public.announcement_acknowledgements FOR INSERT WITH CHECK (
  parent_id = (SELECT auth.uid())
  AND (SELECT private.current_role()) = 'parent'
  AND EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.id = announcement_id
      AND a.tenant_id = (SELECT private.current_tenant_id())
  )
);

-- ---------------------------------------------------------------------------
-- audit_log: APPEND-ONLY. tenant_admin reads their tenant; system_admin reads
-- all. INSERT is performed by the service-role admin client (bypasses RLS), so
-- no INSERT policy is granted to authenticated — there is NO UPDATE/DELETE
-- policy, so the log is immutable to API roles. (service_role bypasses RLS.)
-- ---------------------------------------------------------------------------
CREATE POLICY "audit_log_select" ON public.audit_log FOR SELECT USING (
  (SELECT private.current_role()) = 'system_admin'
  OR (tenant_id = (SELECT private.current_tenant_id())
      AND (SELECT private.current_role()) = 'tenant_admin')
);

-- ---------------------------------------------------------------------------
-- Base table GRANTs. authenticated gets row-gated DML on the feature tables;
-- audit_log is SELECT-only for authenticated (writes come from service_role).
-- service_role already has ALL via the blanket grant in 002, but 002's
-- "GRANT ... ON ALL TABLES" ran before these tables existed, so re-grant.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.teachers, public.events, public.appointment_slots,
  public.appointments, public.announcements,
  public.announcement_acknowledgements
TO authenticated;

GRANT SELECT ON public.audit_log TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.teachers, public.events, public.appointment_slots,
  public.appointments, public.announcements,
  public.announcement_acknowledgements, public.audit_log
TO service_role;
