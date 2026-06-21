import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantAdmin } from "@/lib/auth-guards";
import { writeAudit } from "@/lib/audit";
import { sendInvitationEmail } from "@/lib/resend";

/**
 * tenant_admin: invite ANOTHER tenant_admin into their own tenant. Mirrors
 * invite-parent, minus the student pre-creation.
 *
 * Invariants:
 *   * tenant_id is the CALLER's tenant (server-derived), never from the body.
 *   * The invitation INSERT goes through the user-scoped client so invitations_write
 *     RLS is the second line of defense — its WITH CHECK already permits a
 *     tenant_admin to create a tenant_admin invite in their own tenant and FORBIDS
 *     a system_admin invite. No schema/RLS change was needed for this route.
 *   * The 003 onboarding trigger binds the invitee to the right tenant_id + role
 *     on first OTP login.
 *   * Audit-logged (invitation.create).
 */
const Body = z.object({
  email: z.string().email().max(320).transform((s) => s.trim().toLowerCase()),
});

function newToken(): string {
  return crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { caller, status, error } = await requireTenantAdmin(supabase);
  if (!caller) return NextResponse.json({ error }, { status });
  const tenantId = caller.tenantId;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }
  const { email } = parsed.data;

  // Create the admin invitation (user-scoped → invitations_write RLS is the boundary;
  // WITH CHECK forbids role='system_admin' for a tenant_admin caller).
  const token = newToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: inv, error: iErr } = await supabase
    .from("invitations")
    .insert({ email, role: "tenant_admin", tenant_id: tenantId, token, expires_at: expiresAt })
    .select("id, token")
    .single();
  if (iErr || !inv) {
    return NextResponse.json({ error: "Could not create the invitation." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();
  const tenantName = tenant?.name ?? "your organisation";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const acceptUrl = `${appUrl}/accept-invite?token=${encodeURIComponent(
    inv.token,
  )}&email=${encodeURIComponent(email)}`;

  let emailSent = true;
  try {
    await sendInvitationEmail({ to: email, acceptUrl, tenantName, role: "tenant_admin" });
  } catch (err) {
    emailSent = false;
    console.error("[invite-admin] email failed:", err);
  }

  await writeAudit(admin, {
    tenantId,
    actorId: caller.userId,
    actorRole: "tenant_admin",
    action: "invitation.create",
    targetTable: "invitations",
    targetId: inv.id,
    metadata: { email, role: "tenant_admin", emailSent },
  });

  return NextResponse.json({ ok: true, emailSent });
}
