// Phase 0 exit-criteria verification harness (LOCAL DEV).
// Drives the REAL onboarding spine via @supabase/supabase-js + Mailpit OTP codes,
// then asserts tenant isolation / fail-closed behaviour through RLS.
//
// Run: node scripts/verify-phase0.mjs   (dev stack + supabase must be up)

import { createClient } from "@supabase/supabase-js";

// Keys come from env (load with `node --env-file=.env.local scripts/verify-phase0.mjs`).
// These local-dev defaults are the PUBLIC supabase-demo shared keys (iss=supabase-demo),
// kept only as a fallback so the harness runs against a stock local stack.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

const TENANT_B_INVOICE = "bbbb2222-2222-2222-2222-222222222222";

let pass = 0,
  fail = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass++;
  else fail++;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const anonClient = () => createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

// Poll Mailpit for the newest OTP code sent to `email`.
async function readOtp(email, sinceCount) {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/messages`);
    const { messages } = await res.json();
    const mine = messages.filter((m) => m.To.some((t) => t.Address === email));
    if (mine.length > sinceCount) {
      const id = mine[0].ID;
      // Use the parsed .Text body (clean plaintext) — the raw JSON has \uXXXX
      // escapes that break \b boundaries around the code.
      const body = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
      const text = `${body.Text ?? ""}\n${body.HTML ?? ""}`;
      const m = text.match(/(?<!\d)(\d{6})(?!\d)/);
      if (m) return m[1];
    }
    await sleep(500);
  }
  throw new Error(`No OTP for ${email}`);
}

async function countMailsTo(email) {
  const res = await fetch(`${MAILPIT}/api/v1/messages`);
  const { messages } = await res.json();
  return messages.filter((m) => m.To.some((t) => t.Address === email)).length;
}

// Full OTP onboarding: send (with optional invite_token) → read code → verify.
async function onboard(email, inviteToken) {
  const client = anonClient();
  const before = await countMailsTo(email);
  const { error: sendErr } = await client.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: inviteToken ? { invite_token: inviteToken } : undefined,
    },
  });
  if (sendErr) throw new Error(`send: ${sendErr.message}`);
  const code = await readOtp(email, before);
  const { data, error } = await client.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) throw new Error(`verify: ${error.message}`);
  return { client, user: data.user };
}

async function main() {
  console.log("=== Phase 0 exit-criteria verification ===\n");

  // Clean Mailpit so OTP reads aren't confused by stale messages.
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" }).catch(() => {});

  // ---- Criterion 1+3: parent onboards via token+OTP → correct tenant/role ---
  const { client: parentA, user: pAUser } = await onboard(
    "parent-a@aurora.example",
    "token-aurora-parent",
  );
  const { data: pAProfile } = await parentA
    .from("profiles")
    .select("role, tenant_id, status")
    .eq("id", pAUser.id)
    .maybeSingle();
  const { data: auroraTenant } = await admin
    .from("tenants")
    .select("id")
    .eq("domain_slug", "aurora")
    .single();
  check(
    "C1 parent onboards via invite token+OTP → role=parent in Aurora",
    pAProfile?.role === "parent" && pAProfile?.tenant_id === auroraTenant.id,
    `role=${pAProfile?.role} tenant=${pAProfile?.tenant_id === auroraTenant.id ? "aurora" : pAProfile?.tenant_id}`,
  );

  // ---- Criterion 3 (student link): pre-created student now linked ----
  const { data: linked } = await admin
    .from("students")
    .select("full_name, parent_id")
    .eq("parent_email", "parent-a@aurora.example")
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
  const { client: badTokenClient, user: badUser } = await onboard(
    "intruder@nowhere.example",
    "totally-wrong-token",
  );
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
  const { client: sysAdmin } = await onboard(
    "admin@webcommspay.example",
    "seed-system-admin-token-local-dev-only",
  );
  const { data: allTenants } = await sysAdmin.from("tenants").select("id, name");
  check(
    "C6 system_admin sees BOTH tenants (role short-circuit)",
    allTenants?.length === 2,
    `tenants=${allTenants?.length} (${allTenants?.map((t) => t.name).join(", ")})`,
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
  // restore for repeatability
  await admin.from("profiles").update({ status: "active" }).eq("id", pAUser.id);

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("HARNESS ERROR:", e);
  process.exit(2);
});
