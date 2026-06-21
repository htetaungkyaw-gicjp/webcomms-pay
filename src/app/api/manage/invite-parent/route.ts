import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/audit";
import { sendInvitationEmail } from "@/lib/resend";

/**
 * tenant_admin: invite a parent AND pre-create their child/children in one step
 * (DESIGN.md: "Invite parent" creates the students rows with parent_email set;
 * the 003 trigger links parent_id on the parent's first login).
 *
 * Invariants:
 *   * tenant_id is the CALLER's tenant (server-derived), never from the body.
 *   * INSERTs go through the user-scoped client so RLS (invitations_write,
 *     students_write) is the second line of defense.
 *   * Audit-logged (student.create + invitation.create).
 */
const Body = z.object({
  email: z.string().email().max(320).transform((s) => s.trim().toLowerCase()),
  students: z
    .array(
      z.object({
        fullName: z.string().min(1).max(120),
        className: z.string().max(60).optional(),
      }),
    )
    .min(1)
    .max(10),
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
    .select("role, status, tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (
    !caller ||
    caller.status !== "active" ||
    caller.role !== "tenant_admin" ||
    !caller.tenant_id
  ) {
    return NextResponse.json({ error: "Tenant admins only." }, { status: 403 });
  }
  const tenantId = caller.tenant_id;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid details." }, { status: 400 });
  }
  const { email, students } = parsed.data;

  // Pre-create students with parent_email (user-scoped → students_write RLS).
  const studentRows = students.map((s) => ({
    tenant_id: tenantId,
    parent_email: email,
    full_name: s.fullName,
    class_name: s.className ?? null,
  }));
  const { data: createdStudents, error: sErr } = await supabase
    .from("students")
    .insert(studentRows)
    .select("id");
  if (sErr || !createdStudents) {
    return NextResponse.json({ error: "Could not create the student(s)." }, { status: 400 });
  }

  // Create the parent invitation (user-scoped → invitations_write RLS).
  const token = newToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: inv, error: iErr } = await supabase
    .from("invitations")
    .insert({ email, role: "parent", tenant_id: tenantId, token, expires_at: expiresAt })
    .select("id, token")
    .single();
  if (iErr || !inv) {
    return NextResponse.json({ error: "Could not create the invitation." }, { status: 400 });
  }

  // Email + audit (admin client).
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();
  const tenantName = tenant?.name ?? "your school";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const acceptUrl = `${appUrl}/accept-invite?token=${encodeURIComponent(
    inv.token,
  )}&email=${encodeURIComponent(email)}`;

  let emailSent = true;
  try {
    await sendInvitationEmail({ to: email, acceptUrl, tenantName, role: "parent" });
  } catch (err) {
    emailSent = false;
    console.error("[invite-parent] email failed:", err);
  }

  for (const s of createdStudents) {
    await writeAudit(admin, {
      tenantId,
      actorId: user.id,
      actorRole: "tenant_admin",
      action: "student.create",
      targetTable: "students",
      targetId: s.id,
      metadata: { parentEmail: email },
    });
  }
  await writeAudit(admin, {
    tenantId,
    actorId: user.id,
    actorRole: "tenant_admin",
    action: "invitation.create",
    targetTable: "invitations",
    targetId: inv.id,
    metadata: { email, role: "parent", students: createdStudents.length, emailSent },
  });

  return NextResponse.json({ ok: true, emailSent, students: createdStudents.length });
}
