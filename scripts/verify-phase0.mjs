// Phase 0 exit-criteria verification harness (CLOUD).
// Drives the REAL onboarding spine against the cloud Supabase project and asserts
// tenant isolation / fail-closed behaviour through RLS.
//
// There is no local stack and no Mailpit. Instead of polling an inbox for the OTP,
// we use the service-role Admin API (`generateLink`), which returns the one-time
// `email_otp` WITHOUT sending email. The invite token + full_name are carried in
// user metadata (`data`), exactly as the app's signInWithOtp does, so the 003
// `AFTER INSERT ON auth.users` trigger fires identically.
//
// This harness is SELF-CONTAINED: it seeds its own fixtures (tenants, invitations,
// students, invoices) via the service-role client, runs the assertions, then
// deletes every user/row it created. It mutates the shared cloud dev/stg DB, so it
// uses clearly-namespaced fixtures and cleans up in a finally block.
//
// Run: node --env-file=.env.local scripts/verify-phase0.mjs
//   Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
//   SUPABASE_SERVICE_ROLE_KEY in .env.local, pointing at the cloud project.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON || !SERVICE) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, " +
      "SUPABASE_SERVICE_ROLE_KEY (cloud project). Run with:",
  );
  console.error("  node --env-file=.env.local scripts/verify-phase0.mjs");
  process.exit(2);
}

// Namespaced so this run's fixtures never collide with real data in the shared
// cloud project, and so cleanup can target exactly what we created.
const RUN = "phase0verify";
const TENANT_A = "aaaaaaaa-0000-4000-8000-00000000aaaa";
const TENANT_B = "bbbbbbbb-0000-4000-8000-00000000bbbb";
const STUDENT_A = "a5a5a5a5-0000-4000-8000-00000000a5a5";
const STUDENT_B = "b5b5b5b5-0000-4000-8000-00000000b5b5";
const INVOICE_A = "a1a1a1a1-0000-4000-8000-00000000a1a1";
const TENANT_B_INVOICE = "b1b1b1b1-0000-4000-8000-00000000b1b1";

const email = (who) => `${RUN}+${who}@example.com`;
const PARENT_A = email("parent-a");
const PARENT_B = email("parent-b");
const INTRUDER = email("intruder");
const SYS_ADMIN = email("system-admin");

const TOK_PARENT_A = `${RUN}-token-aurora-parent`;
const TOK_SYS_ADMIN = `${RUN}-token-system-admin`;

let pass = 0,
  fail = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass++;
  else fail++;
}

const anonClient = () => createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

// Full OTP onboarding WITHOUT email: generateLink returns the OTP and carries the
// invite_token through user metadata so the 003 trigger binds the profile.
async function onboard(addr, inviteToken) {
  const { data: gen, error: genErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: addr,
    options: { data: inviteToken ? { invite_token: inviteToken } : {} },
  });
  if (genErr) throw new Error(`generateLink(${addr}): ${genErr.message}`);
  const otp = gen.properties?.email_otp;
  if (!otp) throw new Error(`no email_otp returned for ${addr}`);

  const client = anonClient();
  const { data, error } = await client.auth.verifyOtp({ email: addr, token: otp, type: "email" });
  if (error) throw new Error(`verifyOtp(${addr}): ${error.message}`);
  return { client, user: data.user };
}

// Idempotent self-seed of the fixtures this harness asserts against.
async function seed() {
  await admin.from("tenants").upsert([
    { id: TENANT_A, name: "Aurora Primary (verify)", domain_slug: `${RUN}-aurora`, timezone: "Asia/Singapore" },
    { id: TENANT_B, name: "Brighton Sports (verify)", domain_slug: `${RUN}-brighton`, timezone: "Asia/Singapore" },
  ]);
  await admin.from("invitations").upsert(
    [
      { tenant_id: TENANT_A, email: PARENT_A, role: "parent", token: TOK_PARENT_A, expires_at: new Date(Date.now() + 36e5).toISOString() },
    ],
    { onConflict: "token" },
  );
  await admin.from("students").upsert([
    { id: STUDENT_A, tenant_id: TENANT_A, parent_id: null, parent_email: PARENT_A, full_name: "Amelia Tan", class_name: "Primary 3B" },
    { id: STUDENT_B, tenant_id: TENANT_B, parent_id: null, parent_email: PARENT_B, full_name: "Ben Lim", class_name: "Squad U12" },
  ]);
  await admin.from("invoices").upsert([
    { id: INVOICE_A, tenant_id: TENANT_A, student_id: STUDENT_A, description: "Term 1 tuition", amount_cents: 12500, currency: "sgd", status: "pending" },
    { id: TENANT_B_INVOICE, tenant_id: TENANT_B, student_id: STUDENT_B, description: "Monthly membership", amount_cents: 8000, currency: "sgd", status: "pending" },
  ]);

  // The system_admin invite is normally seeded by migration 004 for a fixed email.
  // Here we seed our own namespaced one so the run is self-contained.
  await admin.from("invitations").upsert(
    [{ tenant_id: null, email: SYS_ADMIN, role: "system_admin", token: TOK_SYS_ADMIN, expires_at: new Date(Date.now() + 36e5).toISOString() }],
    { onConflict: "token" },
  );
}

// Delete every user + row this harness created, in FK-safe order.
async function cleanup() {
  // Auth users (cascades profiles via the FK on profiles.id).
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const mine = (list?.users ?? []).filter((u) => u.email?.startsWith(`${RUN}+`));
  for (const u of mine) await admin.auth.admin.deleteUser(u.id).catch(() => {});

  await admin.from("invoices").delete().in("id", [INVOICE_A, TENANT_B_INVOICE]);
  await admin.from("students").delete().in("id", [STUDENT_A, STUDENT_B]);
  await admin.from("invitations").delete().in("token", [TOK_PARENT_A, TOK_SYS_ADMIN]);
  await admin.from("tenants").delete().in("id", [TENANT_A, TENANT_B]);
}

async function main() {
  console.log("=== Phase 0 exit-criteria verification (cloud) ===\n");
  await cleanup(); // clear any leftovers from a previous interrupted run
  await seed();

  // ---- Criterion 1+3: parent onboards via token+OTP → correct tenant/role ---
  const { client: parentA, user: pAUser } = await onboard(PARENT_A, TOK_PARENT_A);
  const { data: pAProfile } = await parentA
    .from("profiles")
    .select("role, tenant_id, status")
    .eq("id", pAUser.id)
    .maybeSingle();
  check(
    "C1 parent onboards via invite token+OTP → role=parent in Aurora",
    pAProfile?.role === "parent" && pAProfile?.tenant_id === TENANT_A,
    `role=${pAProfile?.role} tenant=${pAProfile?.tenant_id === TENANT_A ? "aurora" : pAProfile?.tenant_id}`,
  );

  // ---- Criterion 3 (student link): pre-created student now linked ----
  const { data: linked } = await admin
    .from("students")
    .select("full_name, parent_id")
    .eq("id", STUDENT_A)
    .maybeSingle();
  check(
    "C3 admin-pre-created student linked to parent on first login",
    linked?.parent_id === pAUser.id,
    `student=${linked?.full_name} parent_id ${linked?.parent_id === pAUser.id ? "set" : "NULL"}`,
  );

  // ---- Criterion 4: parent A sees exactly 1 invoice; 0 of Tenant B's ----
  const { data: pAInvoices } = await parentA.from("invoices").select("id, description");
  check(
    "C4a parent A sees exactly 1 invoice (own child)",
    pAInvoices?.length === 1,
    `count=${pAInvoices?.length} (${pAInvoices?.map((i) => i.description).join(",")})`,
  );
  const { data: bLeak } = await parentA
    .from("invoices")
    .select("id")
    .eq("id", TENANT_B_INVOICE);
  check(
    "C4b direct query for Tenant B invoice id returns empty (RLS, not app logic)",
    (bLeak?.length ?? 0) === 0,
    `rows=${bLeak?.length ?? 0}`,
  );
  const { data: bStudents } = await parentA.from("students").select("id");
  // parent A should see only their own 1 child, never Tenant B's student
  check(
    "C4c parent A sees only their own child (0 Tenant B students)",
    bStudents?.length === 1,
    `students=${bStudents?.length}`,
  );

  // ---- Criterion 2: wrong/absent token → no profile → no access ----
  const { client: badTokenClient, user: badUser } = await onboard(INTRUDER, "totally-wrong-token");
  const { data: badProfile } = await badTokenClient
    .from("profiles")
    .select("id")
    .eq("id", badUser.id)
    .maybeSingle();
  check(
    "C2 wrong invite token → NO profile created (fail closed)",
    !badProfile,
    badProfile ? "profile WAS created (LEAK)" : "no profile",
  );

  // ---- Criterion 6: system_admin sees both tenants ----
  const { client: sysAdmin } = await onboard(SYS_ADMIN, TOK_SYS_ADMIN);
  const { data: adminTenants } = await sysAdmin.from("tenants").select("id").in("id", [TENANT_A, TENANT_B]);
  check(
    "C6 system_admin sees BOTH tenants (role short-circuit)",
    adminTenants?.length === 2,
    `tenants visible=${adminTenants?.length}`,
  );

  // ---- Criterion 7: disabled parent loses access (RLS fail-closed) ----
  await admin.from("profiles").update({ status: "disabled" }).eq("id", pAUser.id);
  // Reuse parent A's still-valid session; RLS helper now returns NULL role/tenant.
  const { data: afterDisable } = await parentA.from("invoices").select("id");
  check(
    "C7 disabled parent can no longer read tenant data (RLS revocation)",
    (afterDisable?.length ?? 0) === 0,
    `rows after disable=${afterDisable?.length ?? 0}`,
  );

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
}

main()
  .catch((e) => {
    console.error("HARNESS ERROR:", e);
    fail++;
  })
  .finally(async () => {
    await cleanup().catch((e) => console.error("CLEANUP ERROR:", e));
    process.exit(fail === 0 ? 0 : 1);
  });
