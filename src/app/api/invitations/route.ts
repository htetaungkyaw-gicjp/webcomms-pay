import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { sendInvitationEmail } from "@/lib/resend";

/**
 * Create an invitation (admin only). The onboarding spine's authorization gate.
 *
 * Cross-tenant invite-injection guard (PLAN.md Critical files):
 *   * tenant_id is ALWAYS derived from the AUTHENTICATED CALLER's profile, NEVER
 *     from the request body. The body carries only { email, role, fullName? }.
 *   * A tenant_admin may create only parent / tenant_admin invites IN THEIR OWN
 *     tenant; only a system_admin may create system_admin invites.
 *   * The INSERT uses the USER-SCOPED (RLS-respecting) client so the
 *     invitations_write WITH CHECK is a second line of defense; the admin client
 *     is used ONLY for the Resend send + audit write (which authenticated can't do).
 *   * Audit-logged (invitation.create).
 *
 * For a parent invite, the admin "Invite parent" UI separately creates the
 * students rows with parent_email set; the 003 trigger links them on first login.
 */
const Body = z.object({
  email: z.string().email().max(320).transform((s) => s.trim().toLowerCase()),
  role: z.enum(["tenant_admin", "parent", "system_admin"]),
  fullName: z.string().max(200).optional(),
});

function newToken(): string {
  return crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
}

export async function POST(request: Request) {
  const supabase = await createClient();

  // 1. Authenticate.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // 2. Caller's role + tenant come from the DB profile (server-derived).
  const { data: caller } = await supabase
    .from("profiles")
    .select("role, status, tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!caller || caller.status !== "active") {
    return NextResponse.json({ error: "No access." }, { status: 403 });
  }
  if (caller.role !== "system_admin" && caller.role !== "tenant_admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  // 3. Validate the body.
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invitation." }, { status: 400 });
  }
  const { email, role, fullName } = parsed.data;

  // 4. Authorize the (role, tenant) the caller is allowed to mint.
  let tenantId: string | null;
  if (caller.role === "system_admin") {
    // system_admin may invite anyone. A system_admin invite is tenant-less;
    // a tenant_admin/parent invite needs a target tenant — system_admin must
    // pass it via a dedicated flow, not this generic route. Here we only allow
    // system_admin to mint a tenant_admin for a SPECIFIC tenant via the body? No:
    // tenant_id must never come from the body. So system_admin uses this route
    // only to mint other system_admin invites; tenant-scoped invites are created
    // by that tenant's own tenant_admin. (Tenant creation + first tenant_admin is
    // handled in the admin tenants flow which sets tenant_id server-side there.)
    if (role !== "system_admin") {
      return NextResponse.json(
        { error: "Use the tenant's own admin to invite into a tenant." },
        { status: 400 },
      );
    }
    tenantId = null;
  } else {
    // tenant_admin: only into their OWN tenant, and NEVER a system_admin.
    if (role === "system_admin") {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
    tenantId = caller.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant." }, { status: 403 });
    }
  }

  // 5. Insert via the USER-SCOPED client → invitations_write WITH CHECK is the
  //    second line of defense (it independently requires the tenant/role match).
  const token = newToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: invitation, error: insErr } = await supabase
    .from("invitations")
    .insert({ email, role, tenant_id: tenantId, token, expires_at: expiresAt })
    .select("id, token, tenant_id")
    .single();

  if (insErr || !invitation) {
    // RLS WITH CHECK rejection lands here too (defense-in-depth caught it).
    return NextResponse.json(
      { error: "Could not create the invitation." },
      { status: 400 },
    );
  }

  // 6. Resolve the tenant name + send the email + audit (admin client).
  const admin = createAdminClient();
  let tenantName = "WebComms & Pay";
  if (invitation.tenant_id) {
    const { data: t } = await admin
      .from("tenants")
      .select("name")
      .eq("id", invitation.tenant_id)
      .maybeSingle();
    if (t) tenantName = t.name;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const acceptUrl = `${appUrl}/accept-invite?token=${encodeURIComponent(
    invitation.token,
  )}&email=${encodeURIComponent(email)}`;

  let emailSent = true;
  try {
    await sendInvitationEmail({ to: email, acceptUrl, tenantName, role });
  } catch (err) {
    // Don't fail the whole request — the invite exists; surface a resend hint.
    emailSent = false;
    console.error("[invitations] email send failed:", err);
  }

  await writeAudit(admin, {
    tenantId: invitation.tenant_id,
    actorId: user.id,
    actorRole: caller.role,
    action: "invitation.create",
    targetTable: "invitations",
    targetId: invitation.id,
    metadata: { email, role, emailSent },
  });

  // Don't return the token to the client — it's a secret carried only by email.
  return NextResponse.json({ ok: true, emailSent, fullName: fullName ?? null });
}
