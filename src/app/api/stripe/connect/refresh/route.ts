import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { checkoutByUser, clientIp } from "@/lib/ratelimit";

/**
 * Re-mint a Stripe Connect onboarding link (Phase 6). Stripe account links are
 * single-use / short-lived; when the previous one expires the manage UI lands on
 * /{slug}/manage/payouts?refresh=1, which calls this to get a fresh URL.
 *
 * Same authorization as /connect/onboard (admin client, authorized in code), but
 * REQUIRES an existing connected account (409 if onboarding was never started).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

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

  if (!tenant.stripe_account_id) {
    return NextResponse.json(
      { error: "Payout setup hasn't been started yet." },
      { status: 409 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = await getStripe().accountLinks.create({
    account: tenant.stripe_account_id,
    type: "account_onboarding",
    refresh_url: `${appUrl}/${slug}/manage/payouts?refresh=1`,
    return_url: `${appUrl}/${slug}/manage/payouts`,
  });

  return NextResponse.json({ url: link.url });
}
