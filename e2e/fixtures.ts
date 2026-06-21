import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role fixtures for the auth E2E. Mirrors scripts/verify-phase0.mjs:
 * seeds a namespaced tenant + invitation + student + invoice for the REAL email
 * the tester will log in as, then tears it all down. The invitation row is what
 * lets the 003 trigger bind a `parent` profile on first OTP verify — without it
 * the deployed UI would (correctly) fail closed and show "no access".
 *
 * These run against the dev/stg cloud project via .env.local. NEVER prod.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Email the human will receive the OTP at. Override with E2E_PARENT_EMAIL.
export const PARENT_EMAIL =
  process.env.E2E_PARENT_EMAIL ?? "htetaungkyaw.5121992@gmail.com";

// Namespaced so this never collides with real stg data and cleanup is exact.
const RUN = "e2eauth";
export const TENANT_ID = "e2e0e2e0-0000-4000-8000-00000000e2e0";
export const TENANT_SLUG = `${RUN}-aurora`;
const STUDENT_ID = "e2e57175-0000-4000-8000-0000000057de";
const INVOICE_ID = "e2e10ce0-0000-4000-8000-0000000010ce";
export const INVITE_TOKEN = `${RUN}-token-parent`;

function adminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE) {
    throw new Error(
      "Missing Supabase env. The auth E2E needs NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY (dev/stg). Run with:\n" +
        '  node --env-file=.env.local node_modules/@playwright/test/cli.js test ...',
    );
  }
  return createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
}

/** Seed tenant + invitation + linked student + pending invoice for PARENT_EMAIL. */
export async function seedParentInvite(): Promise<void> {
  const admin = adminClient();
  await cleanupParent(); // clear leftovers from an interrupted run first

  await admin.from("tenants").upsert([
    {
      id: TENANT_ID,
      name: "Aurora Primary (e2e)",
      domain_slug: TENANT_SLUG,
      timezone: "Asia/Singapore",
    },
  ]);
  await admin.from("invitations").upsert(
    [
      {
        tenant_id: TENANT_ID,
        email: PARENT_EMAIL,
        role: "parent",
        token: INVITE_TOKEN,
        expires_at: new Date(Date.now() + 36e5).toISOString(),
      },
    ],
    { onConflict: "token" },
  );
  await admin.from("students").upsert([
    {
      id: STUDENT_ID,
      tenant_id: TENANT_ID,
      parent_id: null,
      parent_email: PARENT_EMAIL,
      full_name: "Amelia Tan (e2e)",
      class_name: "Primary 3B",
    },
  ]);
  await admin.from("invoices").upsert([
    {
      id: INVOICE_ID,
      tenant_id: TENANT_ID,
      student_id: STUDENT_ID,
      description: "Term 1 tuition (e2e)",
      amount_cents: 12500,
      currency: "sgd",
      status: "pending",
    },
  ]);
}

/** Delete the auth user (cascades the profile) + every seeded row, FK-safe. */
export async function cleanupParent(): Promise<void> {
  const admin = adminClient();

  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const mine = (list?.users ?? []).filter(
    (u) => u.email?.toLowerCase() === PARENT_EMAIL.toLowerCase(),
  );
  for (const u of mine) await admin.auth.admin.deleteUser(u.id).catch(() => {});

  await admin.from("invoices").delete().in("id", [INVOICE_ID]);
  await admin.from("students").delete().in("id", [STUDENT_ID]);
  await admin.from("invitations").delete().in("token", [INVITE_TOKEN]);
  await admin.from("tenants").delete().in("id", [TENANT_ID]);
}
