// Phase 4 booking-guard verification (CLOUD DB). Proves the DB-level invariants
// the /api/appointments/book route relies on:
//   * the partial unique index appointments_slot_active_idx makes a slot hold at
//     most ONE non-cancelled appointment (double-book → 23505),
//   * a cancelled appointment frees the slot (a new booking then succeeds),
//   * appointments RLS denies a parent reading another parent's appointment.
// Self-seeds namespaced fixtures via the service-role client and cleans up after.
// Run: node --env-file=.env.local scripts/verify-booking.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(2);
}
const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

const RUN = "bookingverify";
const TENANT = "d1d1d1d1-0000-4000-8000-00000000d1d1";
const TEACHER = "d2d2d2d2-0000-4000-8000-00000000d2d2";
const SLOT = "d3d3d3d3-0000-4000-8000-00000000d3d3";
const STUDENT = "d4d4d4d4-0000-4000-8000-00000000d4d4";
// Two throwaway auth users to act as parents (so FK parent_id → profiles holds).
let parentA, parentB;

let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass++;
  else fail++;
}

async function cleanup() {
  await admin.from("appointments").delete().eq("tenant_id", TENANT);
  await admin.from("appointment_slots").delete().eq("id", SLOT);
  await admin.from("teachers").delete().eq("id", TEACHER);
  await admin.from("students").delete().eq("id", STUDENT);
  if (parentA) { await admin.from("profiles").delete().eq("id", parentA); await admin.auth.admin.deleteUser(parentA).catch(() => {}); }
  if (parentB) { await admin.from("profiles").delete().eq("id", parentB); await admin.auth.admin.deleteUser(parentB).catch(() => {}); }
  await admin.from("tenants").delete().eq("id", TENANT);
}

async function makeParent(email) {
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  const id = data.user.id;
  await admin.from("profiles").insert({ id, tenant_id: TENANT, email, full_name: email, role: "parent", status: "active" });
  return id;
}

async function main() {
  console.log("=== Phase 4 booking-guard verification (cloud) ===\n");
  await cleanup();

  await admin.from("tenants").insert({ id: TENANT, name: "Booking Verify", domain_slug: `${RUN}-tenant`, timezone: "Asia/Singapore" });
  parentA = await makeParent(`${RUN}-a@example.com`);
  parentB = await makeParent(`${RUN}-b@example.com`);
  await admin.from("teachers").insert({ id: TEACHER, tenant_id: TENANT, full_name: "Ms Test", class_name: "T1" });
  await admin.from("students").insert({ id: STUDENT, tenant_id: TENANT, parent_id: parentA, parent_email: `${RUN}-a@example.com`, full_name: "Child A", class_name: "T1" });
  const future = new Date(Date.now() + 7 * 864e5).toISOString();
  const future2 = new Date(Date.now() + 7 * 864e5 + 18e5).toISOString();
  await admin.from("appointment_slots").insert({ id: SLOT, tenant_id: TENANT, teacher_id: TEACHER, starts_at: future, ends_at: future2 });

  // 1. First booking succeeds.
  const { error: e1 } = await admin.from("appointments").insert({ tenant_id: TENANT, slot_id: SLOT, student_id: STUDENT, parent_id: parentA, status: "pending" });
  check("first booking on a free slot succeeds", !e1, e1?.message ?? "inserted");

  // 2. Second non-cancelled booking on the same slot → 23505 (double-book guard).
  const { error: e2 } = await admin.from("appointments").insert({ tenant_id: TENANT, slot_id: SLOT, student_id: STUDENT, parent_id: parentB, status: "pending" });
  check("second non-cancelled booking on same slot is rejected (23505)", e2?.code === "23505", e2?.code ?? "NO ERROR — guard failed!");

  // 3. Cancel the first → the slot frees → a new booking succeeds.
  await admin.from("appointments").update({ status: "cancelled" }).eq("slot_id", SLOT).eq("parent_id", parentA);
  const { error: e3 } = await admin.from("appointments").insert({ tenant_id: TENANT, slot_id: SLOT, student_id: STUDENT, parent_id: parentB, status: "pending" });
  check("cancelling frees the slot for a new booking", !e3, e3?.message ?? "inserted");

  // 4. RLS: parent A cannot read parent B's appointment (appointments_select
  //    gates the parent branch on parent_id = auth.uid()). Mint a real A-scoped
  //    JWT via the OTP Admin-API path (same technique verify-phase0 uses), then
  //    query appointments as A and assert B's row is invisible.
  const anon = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: `${RUN}-a@example.com` });
  const otp = link?.properties?.email_otp;
  const { data: sess } = await anon.auth.verifyOtp({ email: `${RUN}-a@example.com`, token: otp, type: "email" });
  const aClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${sess.session.access_token}` } },
  });
  // Parent A's own appointments are all cancelled now; parent B holds the active
  // one. A must see 0 active appointments (B's row is not A's).
  const { data: aSees } = await aClient.from("appointments").select("id, parent_id").neq("status", "cancelled");
  const leaked = (aSees ?? []).some((r) => r.parent_id === parentB);
  check("parent A cannot read parent B's appointment (RLS)", !leaked, `A sees ${aSees?.length ?? 0} active, none of B's`);

  await cleanup();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await cleanup(); process.exit(1); });
