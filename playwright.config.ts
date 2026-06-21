import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config — runs against a DEPLOYED Netlify environment (stg),
 * NOT a local dev server. There is no `webServer` block on purpose: the target
 * is the live deploy selected by E2E_BASE_URL.
 *
 * Usage (PowerShell):
 *   $env:E2E_BASE_URL="https://<your-stg>.netlify.app"; npm run e2e
 *
 * The auth spec is human-in-the-loop: it pauses on the OTP screen so you can
 * type the 6-digit code from your inbox, then resume. Run it headed:
 *   $env:E2E_BASE_URL="https://<your-stg>.netlify.app"; npm run e2e:auth
 *
 * Target the dev/stg deploy ONLY — never prod (LIVE Stripe + real PII).
 */
export default defineConfig({
  testDir: "./e2e",
  // Live site → no parallelism surprises; one worker keeps the manual-OTP run sane.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  // Generous because we hit a cold Netlify function + real email round-trips.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    // Default to the deployed Netlify site; override per-run with E2E_BASE_URL.
    // Trailing slash stripped so page.goto("/login") joins cleanly.
    baseURL: (process.env.E2E_BASE_URL ?? "https://webcomms-pay.netlify.app").replace(/\/$/, ""),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
