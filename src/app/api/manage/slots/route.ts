import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireTenantAdmin } from "@/lib/auth-guards";

/**
 * tenant_admin: create an appointment slot for a teacher. The teacher must be in
 * the caller's tenant (verified via an RLS-scoped read — a cross-tenant teacher
 * is invisible). slots_write RLS enforces tenant_id on insert. No is_booked flag:
 * availability is derived from non-cancelled appointments (see Phase 4).
 */
const Body = z.object({
  teacherId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { caller, status, error } = await requireTenantAdmin(supabase);
  if (!caller) return NextResponse.json({ error }, { status });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid slot." }, { status: 400 });
  }
  const { teacherId, startsAt, endsAt } = parsed.data;
  if (new Date(endsAt) <= new Date(startsAt)) {
    return NextResponse.json({ error: "End must be after start." }, { status: 400 });
  }

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, tenant_id")
    .eq("id", teacherId)
    .maybeSingle();
  if (!teacher || teacher.tenant_id !== caller.tenantId) {
    return NextResponse.json({ error: "Unknown teacher." }, { status: 400 });
  }

  const { error: insErr } = await supabase.from("appointment_slots").insert({
    tenant_id: caller.tenantId,
    teacher_id: teacherId,
    starts_at: startsAt,
    ends_at: endsAt,
  });
  if (insErr) {
    return NextResponse.json({ error: "Could not create the slot." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
