import { test, expect } from "@playwright/test";
import {
  PARENT_EMAIL,
  TENANT_SLUG,
  seedParentInvite,
  cleanupParent,
} from "./fixtures";

/**
 * Full auth + onboarding spine, through the REAL deployed Netlify UI:
 *
 *   seed invitation+student (service-role)
 *     → /login, submit PARENT_EMAIL  (real /api/auth/otp/send → real email)
 *     → /verify, HUMAN types the 6-digit OTP from their inbox
 *     → browser runs supabase.auth.verifyOtp → 003 trigger binds the profile
 *     → routed to /<slug>/portal as a parent
 *     → assert the seeded child + invoice are visible (RLS-scoped, real data)
 *   → teardown (delete user + all seeded rows)
 *
 * HUMAN-IN-THE-LOOP: must run HEADED. The test waits up to 5 min for you to type
 * the code into the visible browser. It auto-submits once 6 digits are entered.
 *
 * Run:
 *   $env:E2E_BASE_URL="https://<your-stg>.netlify.app"
 *   npm run e2e:auth
 */

test.beforeAll(async () => {
  // baseURL defaults to the deployed site; seeding needs .env.local creds, which
  // `npm run e2e:auth` loads via --env-file.
  await seedParentInvite();
});

test.afterAll(async () => {
  await cleanupParent();
});

test("parent logs in via Email OTP and reaches their tenant portal", async ({ page }) => {
  // ---- 1. Request a code through the real UI ----
  await page.goto("/login");
  await page.getByLabel("Email").fill(PARENT_EMAIL);
  await page.getByRole("button", { name: /email me a code/i }).click();

  // ---- 2. Land on /verify ----
  await expect(page).toHaveURL(/\/verify\?/, { timeout: 30_000 });
  await expect(page.getByText("Enter your code")).toBeVisible();

  const otpField = page.getByLabel("One-time code");
  await expect(otpField).toBeVisible();

  // ---- 3. HUMAN types the OTP from their inbox ----
  // The instruction is printed to the test runner console AND shown in-page so
  // it's obvious in the headed browser what to do.
  console.log(
    "\n" +
      "==================================================================\n" +
      `  ✉  Check ${PARENT_EMAIL} for the 6-digit code, then type it into\n` +
      "     the browser's 'One-time code' field. The test auto-continues\n" +
      "     once 6 digits are entered. (Up to 5 minutes.)\n" +
      "==================================================================\n",
  );

  // Poll the field until the human has entered 6 digits.
  await expect
    .poll(async () => (await otpField.inputValue()).replace(/\D/g, "").length, {
      timeout: 5 * 60_000, // 5 min for the human + email delivery
      intervals: [1000],
      message: "Waiting for you to type the 6-digit OTP into the browser…",
    })
    .toBe(6);

  // ---- 4. Submit and complete login ----
  await page.getByRole("button", { name: /^verify$/i }).click();

  // ---- 5. Assert routed to the parent portal for the seeded tenant ----
  await expect(page).toHaveURL(
    new RegExp(`/${TENANT_SLUG}/portal`),
    { timeout: 30_000 },
  );

  // ---- 6. The seeded child + invoice are visible (RLS-scoped real data) ----
  await expect(page.getByText(/Amelia Tan/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Term 1 tuition/i)).toBeVisible();
});
