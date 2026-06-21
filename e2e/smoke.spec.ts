import { test, expect } from "@playwright/test";

/**
 * Smoke tests — public, unauthenticated pages on the DEPLOYED Netlify stg site.
 * No DB writes, no auth. These just prove the deploy is up and the auth entry
 * points render. Safe to run any time against dev/stg.
 *
 * Requires E2E_BASE_URL (the stg deploy URL).
 */

// baseURL defaults to the deployed Netlify site (see playwright.config.ts);
// override with E2E_BASE_URL to target a different deploy/preview.

test("landing page loads", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.ok()).toBeTruthy();
  // The deploy responded with HTML, not a Netlify error page.
  await expect(page.locator("body")).toBeVisible();
});

test("login page renders the email form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Sign in")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: /email me a code/i })).toBeVisible();
});

test("verify page redirects to /login when no email is provided", async ({ page }) => {
  // VerifyPage redirect()s to /login if ?email is absent.
  await page.goto("/verify");
  await expect(page).toHaveURL(/\/login/);
});

test("submitting an email reaches the OTP route (advance or rate-limit)", async ({ page }) => {
  // Drives the real /api/auth/otp/send route via the UI. We do NOT assert a
  // successful send: Supabase enforces a per-email 55s cooldown
  // (error_code "over_email_send_rate_limit"), so a recent send makes the route
  // return 429 and the form (by design) stays on /login showing an error toast.
  // Either outcome proves the route is wired up — that's all smoke needs. The
  // real send + login is exercised by auth-onboarding.spec.ts.
  // Throwaway address so no real inbox/quota is meaningfully consumed.
  await page.goto("/login");
  await page.getByLabel("Email").fill("e2e-smoke-noinvite@example.com");
  await page.getByRole("button", { name: /email me a code/i }).click();

  const advanced = page.waitForURL(/\/verify\?/, { timeout: 30_000 }).then(() => "verify" as const);
  const rateLimited = page
    .getByText(/after \d+ seconds|too many|try again/i)
    .waitFor({ timeout: 30_000 })
    .then(() => "ratelimited" as const);

  const outcome = await Promise.race([advanced, rateLimited]).catch(() => null);
  expect(outcome, "OTP-send route neither advanced to /verify nor returned a rate-limit message").not.toBeNull();
});

test("security headers are present on the deploy", async ({ page }) => {
  // next.config.ts headers() must survive the Netlify Next runtime.
  const res = await page.goto("/login");
  const headers = res?.headers() ?? {};
  expect(headers["content-security-policy"], "CSP header missing").toBeTruthy();
  expect(
    headers["x-frame-options"] || headers["content-security-policy"]?.includes("frame-ancestors"),
    "no clickjacking protection (X-Frame-Options or frame-ancestors)",
  ).toBeTruthy();
});
