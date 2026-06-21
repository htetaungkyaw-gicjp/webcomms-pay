import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { checkoutByUser, clientIp } from "@/lib/ratelimit";

/**
 * Stripe Connect onboarding (Phase 6, see .claude/plan/PHASE-6-CONNECT.md).
 *
 * Creates-or-reuses the tenant's connected account and returns a Stripe-hosted
 * onboarding link. Uses the admin client (writes stripe_account_id onto tenants,
 * which tenants_write forbids for tenant_admin) — so authorization is EXPLICIT
 * CODE, not RLS:
 *
 *   1. getUser() (RLS client) to identify the caller; 401 if none.
 *   2. Per-user rate limit (anti-spam on an external Stripe call); 429.
 *   3. Caller must be tenant_admin OF the tenant named by the body slug (or
 *      system_admin); else 403. tenant_id comes from the PROFILE, never the body.
 *   4. Create the connected account if absent (idempotent — never a 2nd acct).
 *   5. accountLinks.create(account_onboarding) back to /{slug}/manage/payouts.
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

  // 2. Per-user rate limit (reuses the checkout limiter — same cost profile).
  const rl = await checkoutByUser(`connect:${user.id}:${clientIp(request.headers)}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a moment." },
      { status: 429 },
    );
  }

  let body: { slug?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const slug = typeof body.slug === "string" ? body.slug : null;
  if (!slug) {
    return NextResponse.json({ error: "Missing tenant slug." }, { status: 400 });
  }

  const admin = createAdminClient();

  // 3. Authorize: resolve the caller's profile and require tenant_admin of THIS
  //    tenant (or system_admin). tenant_id is derived from the profile.
  const { data: profile } = await admin
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "No profile." }, { status: 403 });
  }

  const { data: tenant, error: tErr } = await admin
    .from("tenants")
    .select("id, domain_slug, stripe_account_id")
    .eq("domain_slug", slug)
    .single();
  if (tErr || !tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const authorized =
    profile.role === "system_admin" ||
    (profile.role === "tenant_admin" && profile.tenant_id === tenant.id);
  if (!authorized) {
    return NextResponse.json(
      { error: "Not authorized to set up payouts for this organisation." },
      { status: 403 },
    );
  }

  // 4. Create the connected account once; reuse if it already exists.
  let accountId = tenant.stripe_account_id;
  if (!accountId) {
    const account = await getStripe().accounts.create({
      type: "express",
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { tenant_id: tenant.id },
    });
    accountId = account.id;
    const { error: updErr } = await admin
      .from("tenants")
      .update({ stripe_account_id: accountId })
      .eq("id", tenant.id);
    if (updErr) {
      return NextResponse.json({ error: "Could not start onboarding." }, { status: 500 });
    }
  }

  // 5. Hand back a fresh Stripe-hosted onboarding link.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = await getStripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${appUrl}/${slug}/manage/payouts?refresh=1`,
    return_url: `${appUrl}/${slug}/manage/payouts`,
  });

  // 6.
  return NextResponse.json({ url: link.url });
}
