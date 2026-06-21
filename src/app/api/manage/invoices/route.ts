import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireTenantAdmin } from "@/lib/auth-guards";

/**
 * tenant_admin: create an invoice for a student in their tenant. Uses the
 * user-scoped (RLS) client throughout — invoices_write WITH CHECK enforces
 * tenant_id = caller's tenant, and the student_id is verified to belong to the
 * tenant via an RLS-scoped read (a student in another tenant simply isn't
 * visible, so the lookup returns nothing → 400). No admin client → no IDOR
 * surface here. Amount is integer minor units (server-authoritative for checkout).
 */
const Body = z.object({
  studentId: z.string().uuid(),
  description: z.string().min(1).max(200),
  amountCents: z.number().int().min(1).max(100_000_00),
  currency: z.string().length(3).toLowerCase().default("sgd"),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { caller, status, error } = await requireTenantAdmin(supabase);
  if (!caller) return NextResponse.json({ error }, { status });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invoice." }, { status: 400 });
  }
  const { studentId, description, amountCents, currency } = parsed.data;

  // Verify the student is visible to this admin (RLS → same tenant only).
  const { data: student } = await supabase
    .from("students")
    .select("id, tenant_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!student || student.tenant_id !== caller.tenantId) {
    return NextResponse.json({ error: "Unknown student." }, { status: 400 });
  }

  const { error: insErr } = await supabase.from("invoices").insert({
    tenant_id: caller.tenantId,
    student_id: studentId,
    description,
    amount_cents: amountCents,
    currency,
    status: "pending",
  });
  if (insErr) {
    return NextResponse.json({ error: "Could not create the invoice." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
