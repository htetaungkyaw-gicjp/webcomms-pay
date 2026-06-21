import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantAdmin } from "@/lib/auth-guards";
import { writeAudit } from "@/lib/audit";

/**
 * tenant_admin: manually settle an invoice paid OUTSIDE Stripe (cash / bank
 * transfer). Uses the user-scoped client throughout — invoices_select/_write RLS
 * scope every read and the UPDATE to the caller's tenant (an invoice in another
 * tenant simply isn't visible → 404). No admin client → no IDOR surface for the
 * mutation; the admin client is used only for the append-only audit write.
 *
 * Idempotency: only flips a CURRENTLY pending invoice; a void or already-paid
 * invoice is rejected so we never overwrite a Stripe-set paid_at.
 */
const Body = z.object({
  invoiceId: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { caller, status, error } = await requireTenantAdmin(supabase);
  if (!caller) return NextResponse.json({ error }, { status });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { invoiceId } = parsed.data;

  // RLS scopes this read to the caller's tenant — another tenant's invoice is invisible.
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, status, tenant_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice || invoice.tenant_id !== caller.tenantId) {
    return NextResponse.json({ error: "Unknown invoice." }, { status: 404 });
  }
  if (invoice.status !== "pending") {
    return NextResponse.json({ error: "Invoice is not pending." }, { status: 409 });
  }

  // User-scoped UPDATE — invoices_write RLS is the boundary. Guarded on the
  // current pending status so concurrent settlement can't double-flip.
  const { data: updated, error: updErr } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (updErr || !updated) {
    return NextResponse.json({ error: "Could not mark as paid." }, { status: 400 });
  }

  await writeAudit(createAdminClient(), {
    tenantId: caller.tenantId,
    actorId: caller.userId,
    actorRole: "tenant_admin",
    action: "invoice.mark_paid",
    targetTable: "invoices",
    targetId: invoiceId,
    metadata: { method: "offline" },
  });

  return NextResponse.json({ ok: true });
}
