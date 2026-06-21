-- ============================================================================
-- 005_feature_schema.sql  —  WebComms & Pay
-- The remaining feature tables deferred from the Phase 0 walking skeleton
-- (PLAN.md §1-G): events, teachers, appointment_slots, appointments,
-- announcements, announcement_acknowledgements, audit_log.
--
-- Design decisions baked in (cannot be retrofitted):
--   * appointment_slots has NO is_booked flag — availability is DERIVED (a slot
--     is free iff no non-cancelled appointment references it). The partial
--     unique index below is the SOLE source of truth against double-booking.
--   * appointments.status is NOT NULL DEFAULT 'pending' — a NULL status would
--     make `status != 'cancelled'` evaluate to NULL and silently drop the row
--     from the partial index, allowing a double-book.
--   * teachers.class_name lets a child's teacher be expressed (parent scheduling
--     is filtered to the child's teacher via class_name).
--   * appointment_slots times are timestamptz (interpreted against tenants.timezone
--     in the UI); we store absolute instants to avoid tz ambiguity.
--   * audit_log is APPEND-ONLY (INSERT-only RLS in 006, no UPDATE/DELETE) and is
--     EXCLUDED from cascade deletes (tenant_id ON DELETE SET NULL, actor_id no FK)
--     so the accountability trail survives erasure.
--   * announcement_acknowledgements is immutable (INSERT-only, no UPDATE/DELETE).
-- ============================================================================

-- --- Enums --------------------------------------------------------------------
CREATE TYPE public.event_type AS ENUM ('general', 'holiday', 'exam', 'activity', 'meeting');
CREATE TYPE public.appointment_status AS ENUM ('pending', 'confirmed', 'cancelled');

-- --- teachers -----------------------------------------------------------------
-- class_name ties a teacher to the class a student belongs to (students.class_name).
CREATE TABLE public.teachers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  class_name  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX teachers_tenant_idx ON public.teachers (tenant_id);
CREATE INDEX teachers_class_idx ON public.teachers (tenant_id, class_name);

-- --- events  (school calendar) -----------------------------------------------
CREATE TABLE public.events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  event_type  public.event_type NOT NULL DEFAULT 'general',
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT events_time_order CHECK (ends_at >= starts_at)
);
CREATE INDEX events_tenant_idx ON public.events (tenant_id);
CREATE INDEX events_starts_idx ON public.events (tenant_id, starts_at);

-- --- appointment_slots  (no is_booked — availability is derived) -------------
CREATE TABLE public.appointment_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  teacher_id  UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT slots_time_order CHECK (ends_at > starts_at)
);
CREATE INDEX slots_tenant_idx ON public.appointment_slots (tenant_id);
CREATE INDEX slots_teacher_idx ON public.appointment_slots (teacher_id);
CREATE INDEX slots_starts_idx ON public.appointment_slots (tenant_id, starts_at);

-- --- appointments -------------------------------------------------------------
-- The booking INSERT goes through the admin client (Phase 4, authorized in code);
-- the RLS policy in 006 still exists as defense-in-depth for any non-admin path.
-- status NOT NULL DEFAULT 'pending' is load-bearing for the partial index below.
CREATE TABLE public.appointments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slot_id     UUID NOT NULL REFERENCES public.appointment_slots(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      public.appointment_status NOT NULL DEFAULT 'pending',
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX appointments_tenant_idx ON public.appointments (tenant_id);
CREATE INDEX appointments_parent_idx ON public.appointments (parent_id);
CREATE INDEX appointments_student_idx ON public.appointments (student_id);

-- Double-booking guard — the SOLE source of truth. A slot can have at most one
-- non-cancelled appointment. The booking route relies on the 23505 violation.
CREATE UNIQUE INDEX appointments_slot_active_idx
  ON public.appointments (slot_id) WHERE status != 'cancelled';

-- --- announcements  (tenant_admin authored, rendered to all parents) ---------
-- Content is stored as plain text and rendered ESCAPED (see Phase 3). No HTML.
CREATE TABLE public.announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  is_urgent   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX announcements_tenant_idx ON public.announcements (tenant_id);
CREATE INDEX announcements_created_idx ON public.announcements (tenant_id, created_at DESC);

-- --- announcement_acknowledgements  (immutable, INSERT-only) -----------------
-- One "Noted" per (announcement, parent). No UPDATE/DELETE policies in 006.
CREATE TABLE public.announcement_acknowledgements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id  UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  parent_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  acknowledged_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ack_unique UNIQUE (announcement_id, parent_id)
);
CREATE INDEX ack_announcement_idx ON public.announcement_acknowledgements (announcement_id);
CREATE INDEX ack_parent_idx ON public.announcement_acknowledgements (parent_id);

-- --- audit_log  (append-only, survives erasure) ------------------------------
-- tenant_id ON DELETE SET NULL and actor_id has NO FK so the trail is NOT
-- cascade-deleted when a tenant or user is erased (GDPR accountability).
-- Written from admin-client routes for security-relevant events.
CREATE TABLE public.audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  actor_id      UUID,                 -- no FK: must survive actor erasure
  actor_role    public.user_role,
  action        TEXT NOT NULL,
  target_table  TEXT,
  target_id     UUID,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_tenant_idx ON public.audit_log (tenant_id, created_at DESC);
CREATE INDEX audit_log_actor_idx ON public.audit_log (actor_id);
