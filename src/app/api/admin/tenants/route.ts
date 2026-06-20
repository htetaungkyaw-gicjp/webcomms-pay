import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { sendInvitationEmail } from "@/lib/resend";

/**
 * system_admin-only: create a tenant and (optionally) invite its first
 * tenant_admin in one step. This is where a tenant-scoped invitation legitimately
 * gets its tenant_id — NOT from a client-claimed id, but from the tenant THIS
 * request just created. So the "tenant_id never from the body" invariant holds:
 * the body names the new tenant, the server assigns the id.
 *
 * The tenant INSERT goes through the user-scoped client so tenants_write RLS
 * (system_admin only) is the second line of defense. The first-admin invite +
 * email + audit use the admin client.
 */
const Body = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "lowercase letters, digits, hyphens"),
  timezone: z.string().max(64).optional(),
  adminEmail: z.string().email().max(320).optional(),
});

function newToken(): string {
  return crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: caller } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (!caller || caller.status !== "active" || caller.role !== "system_admin") {
    return NextResponse.json({ error: "System admins only." }, { status: 403 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid tenant details." }, { status: 400 });
  }
  const { name, slug, timezone, adminEmail } = parsed.data;

  // Create the tenant (RLS: system_admin only — second defense).
  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .insert({ name, domain_slug: slug, ...(timezone ? { timezone } : {}) })
    .select("id, name, domain_slug")
    .single();
  if (tErr || !tenant) {
    const dup = tErr?.code === "23505";
    return NextResponse.json(
      { error: dup ? "That slug is already taken." : "Could not create the tenant." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  await writeAudit(admin, {
    tenantId: tenant.id,
    actorId: user.id,
    actorRole: "system_admin",
    action: "tenant.create",
    targetTable: "tenants",
    targetId: tenant.id,
    metadata: { slug },
  });

  // Optionally invite the first tenant_admin — tenant_id is the new tenant's id.
  let invited: { emailSent: boolean } | null = null;
  if (adminEmail) {
    const email = adminEmail.trim().toLowerCase();
    const token = newToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: inv, error: iErr } = await supabase
      .from("invitations")
      .insert({ email, role: "tenant_admin", tenant_id: tenant.id, token, expires_at: expiresAt })
      .select("id, token")
      .single();

    if (!iErr && inv) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const acceptUrl = `${appUrl}/accept-invite?token=${encodeURIComponent(
        inv.token,
      )}&email=${encodeURIComponent(email)}`;
      let emailSent = true;
      try {
        await sendInvitationEmail({ to: email, acceptUrl, tenantName: tenant.name, role: "tenant_admin" });
      } catch (err) {
        emailSent = false;
        console.error("[admin/tenants] invite email failed:", err);
      }
      await writeAudit(admin, {
        tenantId: tenant.id,
        actorId: user.id,
        actorRole: "system_admin",
        action: "invitation.create",
        targetTable: "invitations",
        targetId: inv.id,
        metadata: { email, role: "tenant_admin", emailSent },
      });
      invited = { emailSent };
    }
  }

  return NextResponse.json({ ok: true, tenant, invited });
}
