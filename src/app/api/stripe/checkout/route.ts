import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { checkoutByUser, clientIp } from "@/lib/ratelimit";

/**
 * Server-authoritative Stripe Checkout. Uses the admin client (it writes
 * stripe_checkout_session_id back onto invoices, which invoices RLS forbids
 * parents from doing) — so ownership is enforced by EXPLICIT CODE, not RLS:
 *
 *   1. getUser() (RLS client) to identify the caller; 401 if none.
 *   2. Re-fetch invoices via the admin client filtered by id ∈ requested AND
 *      status='pending' AND student belongs to this parent. Reject if fewer
 *      rows come back than requested (some ids weren't theirs → 403).
 *   3. Reject mixed currencies → 400.
 *   4. line_items built from DB amounts (cents), never from client input.
 *   5. Create the session, write session.id onto each invoice (admin client).
 *   6. Return { url }.
 */
export async function POST(request: Request) {
  // 1. Authenticate the caller.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Per-user rate limit (anti-spam on an expensive external call).
  const rl = await checkoutByUser(`${user.id}:${clientIp(request.headers)}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please wait a moment." },
      { status: 429 },
    );
  }

  let body: { slug?: string; invoiceIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const requestedIds = Array.isArray(body.invoiceIds)
    ? body.invoiceIds.filter((x): x is string => typeof x === "string")
    : [];
  if (requestedIds.length === 0) {
    return NextResponse.json({ error: "No invoices selected." }, { status: 400 });
  }

  const admin = createAdminClient();

  // 2. Re-fetch with EXPLICIT ownership filter (admin client bypasses RLS).
  //    Ownership = invoice's student belongs to this caller.
  const { data: ownedStudents } = await admin
    .from("students")
    .select("id")
    .eq("parent_id", user.id);
  const ownedStudentIds = (ownedStudents ?? []).map((s) => s.id);

  const { data: invoices, error: invErr } = await admin
    .from("invoices")
    .select("id, amount_cents, currency, description, student_id, status, tenant_id")
    .in("id", requestedIds)
    .eq("status", "pending")
    .in("student_id", ownedStudentIds.length ? ownedStudentIds : ["00000000-0000-0000-0000-000000000000"]);

  if (invErr) {
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }

  // Some requested ids weren't the caller's pending invoices → tampering.
  if (!invoices || invoices.length !== requestedIds.length) {
    return NextResponse.json(
      { error: "One or more invoices are not payable by this account." },
      { status: 403 },
    );
  }

  // 3. Reject mixed currencies (one Checkout Session = one currency).
  const currencies = new Set(invoices.map((i) => i.currency));
  if (currencies.size > 1) {
    return NextResponse.json(
      { error: "Invoices have mixed currencies; pay them separately." },
      { status: 400 },
    );
  }

  // 3b. Connect gate (Phase 6, see PHASE-6-CONNECT.md). All owned invoices share
  //     a tenant (RLS + the ownership filter guarantee it); load that tenant's
  //     connected account and FAIL CLOSED unless it can accept payments. Never
  //     start a checkout we can't route to the school.
  const { data: tenant } = await admin
    .from("tenants")
    .select("stripe_account_id, stripe_charges_enabled")
    .eq("id", invoices[0].tenant_id)
    .single();
  if (!tenant?.stripe_account_id || !tenant.stripe_charges_enabled) {
    return NextResponse.json(
      { error: "This organisation hasn't finished payment setup." },
      { status: 409 },
    );
  }

  // 4. line_items from DB amounts only.
  const line_items = invoices.map((inv) => ({
    quantity: 1,
    price_data: {
      currency: inv.currency,
      unit_amount: inv.amount_cents,
      product_data: { name: inv.description || "Invoice" },
    },
  }));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  // Carry the tenant slug onto the return pages so their CTAs can link straight
  // back to the parent's portal. Presentation-only; not trusted for auth.
  const slugQuery =
    typeof body.slug === "string" && body.slug
      ? `?slug=${encodeURIComponent(body.slug)}`
      : "";

  // 5. Create session + persist session.id for the webhook reverse-lookup.
  //    Destination charge (Phase 6): funds settle into the tenant's connected
  //    account; application_fee_amount is the platform's cut. v1 take rate is 0
  //    (pricing TBD — see PHASE-6-CONNECT.md decision record); the field is here
  //    so enabling a fee is a config change, not a code change.
  const platformFeeCents = 0;
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items,
    success_url: `${appUrl}/payment-success${slugQuery}`,
    cancel_url: `${appUrl}/payment-cancelled${slugQuery}`,
    payment_intent_data: {
      ...(platformFeeCents > 0 ? { application_fee_amount: platformFeeCents } : {}),
      transfer_data: { destination: tenant.stripe_account_id },
    },
  });

  const { error: updErr } = await admin
    .from("invoices")
    .update({ stripe_checkout_session_id: session.id })
    .in(
      "id",
      invoices.map((i) => i.id),
    );
  if (updErr) {
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }

  // 6.
  return NextResponse.json({ url: session.url });
}
