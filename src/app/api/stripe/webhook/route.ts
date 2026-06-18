import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

/**
 * Stripe webhook — idempotent. This route is EXCLUDED from the middleware
 * matcher so the raw body survives for signature verification.
 *
 *   1. Read the raw body via request.text() (App Router does not auto-parse).
 *   2. constructEvent(body, sig, secret); 400 on bad signature.
 *   3. Idempotency: INSERT event.id into processed_stripe_events; on conflict
 *      return 200 (already handled).
 *   4. checkout.session.completed → mark invoices paid BY session id.
 *   5. checkout.session.expired / async_payment_failed → return to pending.
 */
export async function POST(request: Request) {
  const body = await request.text(); // raw body — required for signature check
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing signature/secret." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "bad signature";
    return NextResponse.json({ error: `Webhook signature failed: ${message}` }, { status: 400 });
  }

  const admin = createAdminClient();

  // 3. Idempotency: first writer wins; a re-delivery conflicts → no-op 200.
  const { error: dupeErr } = await admin
    .from("processed_stripe_events")
    .insert({ event_id: event.id });
  if (dupeErr) {
    // Unique-violation (already processed) or any insert error → ack to stop
    // redelivery storms; the original delivery did the work.
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await admin
        .from("invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("stripe_checkout_session_id", session.id);
      break;
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // Return to pending so the parent can retry (avoid stuck state).
      await admin
        .from("invoices")
        .update({ status: "pending", stripe_checkout_session_id: null })
        .eq("stripe_checkout_session_id", session.id)
        .neq("status", "paid");
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
