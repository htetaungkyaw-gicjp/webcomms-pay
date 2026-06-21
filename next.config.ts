import type { NextConfig } from "next";

/**
 * Static security headers (PLAN.md §5 "Security checklist") — general hardening.
 *
 * NOTE: the Content-Security-Policy is intentionally NOT here. It needs a
 * per-request nonce so Next can stamp it onto its inline framework/hydration
 * scripts (Turbopack's production output emits inline bootstrap <script>s).
 * A static, nonce-less `script-src 'self'` blocks those and breaks hydration.
 * The CSP is therefore built and set in src/middleware.ts (buildCsp). Keep the
 * two in sync if the third-party allowlist (Stripe/Supabase) changes.
 *
 *   * frame-ancestors 'none' / X-Frame-Options DENY — never framed (clickjacking).
 *   * HSTS is set; harmless on localhost (browsers ignore it over http).
 */

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
