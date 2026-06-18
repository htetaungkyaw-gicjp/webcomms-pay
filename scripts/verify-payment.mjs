// Phase 0 payment-leg verification (LOCAL DEV).
// Creates a REAL Stripe Checkout Session with the test key, then delivers a
// properly-signed checkout.session.completed event to the webhook (exercising
// the real constructEvent signature path + idempotency + paid-flip). Only the
// network delivery is simulated — the signature is computed exactly as Stripe.
//
// Run: node scripts/verify-payment.mjs   (dev server + supabase up, Stripe env set)

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
// Public supabase-demo local default as fallback; prefer env.
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const WEBHOOK_URL = "http://localhost:3000/api/stripe/webhook";
const WHSEC = process.env.STRIPE_WEBHOOK_SECRET;
const SK = process.env.STRIPE_SECRET_KEY;
const INVOICE = "bbbb1111-1111-1111-1111-111111111111";

let pass = 0,
  fail = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass++;
  else fail++;
}

const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
const stripe = new Stripe(SK, { apiVersion: "2026-05-27.dahlia" });

// Build the Stripe-format signature header for a raw payload.
function signedHeader(payload, secret) {
  // Current time — constructEvent enforces a 300s tolerance by default.
  const t = Math.floor(Date.now() / 1000);
  const signed = `${t}.${payload}`;
  const sig = crypto.createHmac("sha256", secret).update(signed, "utf8").digest("hex");
  return `t=${t},v1=${sig}`;
}

async function main() {
  console.log("=== Phase 0 payment-leg verification ===\n");

  if (!WHSEC || !SK) {
    console.error("STRIPE_WEBHOOK_SECRET / STRIPE_SECRET_KEY not in env. Run with dotenv:");
    console.error("  node --env-file=.env.local scripts/verify-payment.mjs");
    process.exit(2);
  }

  // Ensure clean pending state.
  await admin.from("invoices").update({ status: "pending", paid_at: null }).eq("id", INVOICE);
  await admin.from("processed_stripe_events").delete().neq("event_id", "");

  // 1. Read the invoice (server-authoritative amount).
  const { data: inv } = await admin
    .from("invoices")
    .select("amount_cents, currency, description")
    .eq("id", INVOICE)
    .single();

  // 2. Create a REAL Checkout Session (proves the checkout route's Stripe call).
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: inv.currency,
          unit_amount: inv.amount_cents,
          product_data: { name: inv.description },
        },
      },
    ],
    success_url: "http://localhost:3000/payment-success",
    cancel_url: "http://localhost:3000/payment-cancelled",
  });
  check("Real Stripe Checkout Session created with DB amount", !!session.id && session.url?.includes("checkout.stripe.com"), session.id);

  // Persist session id onto the invoice (what the checkout route step 5 does).
  await admin.from("invoices").update({ stripe_checkout_session_id: session.id }).eq("id", INVOICE);

  // 3. Build + sign a checkout.session.completed event referencing the real session.
  const event = {
    id: "evt_phase0_test_1",
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: session.id, object: "checkout.session", payment_status: "paid" } },
  };
  const payload = JSON.stringify(event);
  const header = signedHeader(payload, WHSEC);

  // 4. Deliver to the webhook with a VALID signature.
  const res1 = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": header },
    body: payload,
  });
  const body1 = await res1.json();
  check("Webhook accepts a validly-signed event (200)", res1.status === 200, `status=${res1.status} ${JSON.stringify(body1)}`);

  const { data: afterPay } = await admin.from("invoices").select("status, paid_at").eq("id", INVOICE).single();
  check("Invoice flipped to paid by session-id reverse lookup", afterPay.status === "paid" && !!afterPay.paid_at, `status=${afterPay.status}`);

  // 5. Re-deliver the SAME event → idempotent no-op (still paid, flagged duplicate).
  const res2 = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": header },
    body: payload,
  });
  const body2 = await res2.json();
  check("Re-delivery is idempotent (200 duplicate, no double-processing)", res2.status === 200 && body2.duplicate === true, JSON.stringify(body2));

  // 6. Bad signature → 400.
  const resBad = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
    body: payload,
  });
  check("Tampered/invalid signature → 400", resBad.status === 400, `status=${resBad.status}`);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("HARNESS ERROR:", e);
  process.exit(2);
});
