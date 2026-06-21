import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireTenantAdmin } from "@/lib/auth-guards";

/**
 * tenant_admin: create a teacher with an optional class_name (which ties the
 * teacher to students in that class for child-scoped booking). User-scoped
 * client → teachers_write RLS enforces tenant scoping.
 */
const Body = z.object({
  fullName: z.string().min(1).max(120),
  className: z.string().max(60).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { caller, status, error } = await requireTenantAdmin(supabase);
  if (!caller) return NextResponse.json({ error }, { status });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid teacher." }, { status: 400 });
  }

  const { error: insErr } = await supabase.from("teachers").insert({
    tenant_id: caller.tenantId,
    full_name: parsed.data.fullName,
    class_name: parsed.data.className ?? null,
  });
  if (insErr) {
    return NextResponse.json({ error: "Could not create the teacher." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
