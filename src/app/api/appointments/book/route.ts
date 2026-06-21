import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bookingByUser, clientIp } from "@/lib/ratelimit";

/**
 * Book a parent-teacher meeting (PLAN.md §Phase 4). Uses the admin client (RLS-
 * bypassing), so authorization is MANDATORY EXPLICIT CODE — this is the IDOR fix:
 *
 *   1. getUser() (user-scoped) to identify the caller; 401 if none.
 *   2. Authorize the resource against the caller's profile:
 *        - the student is the caller's child (student.parent_id = caller.id),
 *        - the slot is in the caller's tenant,
 *        - the slot's teacher actually teaches that child (teacher.class_name =
 *          student.class_name) — child-scoped, mirrors the UI narrowing.
 *      403 on any mismatch.
 *   3. Atomic insert: rely on the partial unique index
 *      (appointments_slot_active_idx). Catch Postgres 23505 → 409 "slot already
 *      booked". No is_booked flag, no read-then-write, no manual rollback.
 *
 * Per-user rate-limited (anti slot-griefing).
 */
const Body = z.object({
  slug: z.string().optional(),
  slotId: z.string().uuid(),
  studentId: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  // Per-user rate limit (anti-griefing).
  const rl = await bookingByUser(`${user.id}:${clientIp(request.headers)}`);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many booking attempts. Slow down." }, { status: 429 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid booking." }, { status: 400 });
  }
  const { slotId, studentId } = parsed.data;

  // Caller's profile (server-derived role + tenant).
  const { data: caller } = await supabase
    .from("profiles")
    .select("role, status, tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!caller || caller.status !== "active" || caller.role !== "parent" || !caller.tenant_id) {
    return NextResponse.json({ error: "Parents only." }, { status: 403 });
  }

  const admin = createAdminClient();

  // --- AUTHORIZE THE RESOURCE (admin client bypasses RLS) ---
  // Student must be the caller's child.
  const { data: student } = await admin
    .from("students")
    .select("id, parent_id, tenant_id, class_name")
    .eq("id", studentId)
    .maybeSingle();
  if (!student || student.parent_id !== user.id) {
    return NextResponse.json({ error: "Not your child." }, { status: 403 });
  }

  // Slot must exist, be in the caller's tenant, and not be in the past.
  const { data: slot } = await admin
    .from("appointment_slots")
    .select("id, tenant_id, teacher_id, starts_at, teachers(class_name)")
    .eq("id", slotId)
    .maybeSingle();
  if (!slot || slot.tenant_id !== caller.tenant_id || student.tenant_id !== slot.tenant_id) {
    return NextResponse.json({ error: "Unknown slot." }, { status: 403 });
  }
  if (new Date(slot.starts_at) <= new Date()) {
    return NextResponse.json({ error: "That slot is in the past." }, { status: 400 });
  }

  // The slot's teacher must teach the child (class_name match) — child-scoped.
  const teacherClass = slot.teachers?.class_name ?? null;
  if (!teacherClass || !student.class_name || teacherClass !== student.class_name) {
    return NextResponse.json(
      { error: "That teacher doesn't teach your child's class." },
      { status: 403 },
    );
  }

  // --- ATOMIC INSERT (partial unique index is the sole double-book guard) ---
  const { error: insErr } = await admin.from("appointments").insert({
    tenant_id: caller.tenant_id,
    slot_id: slotId,
    student_id: studentId,
    parent_id: user.id,
    status: "pending",
  });

  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json({ error: "Slot already booked." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not book the slot." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
