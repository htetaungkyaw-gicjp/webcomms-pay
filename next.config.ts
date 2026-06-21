import type { NextConfig } from "next";

/**
 * Security headers (PLAN.md §5 "Security checklist"). A backstop against stored
 * XSS from tenant-authored content (announcements) plus general hardening. The
 * CSP allowlists exactly the third-party origins we use:
 *   * Stripe.js  (js.stripe.com) + Stripe Checkout iframe (checkout.stripe.com)
 *   * Supabase   (the project REST/Auth origin, from NEXT_PUBLIC_SUPABASE_URL)
 *
 * Notes / trade-offs:
 *   * 'unsafe-inline' is allowed for STYLES only (Tailwind/Next inject inline
 *     styles); scripts do NOT get 'unsafe-inline'. Next's framework scripts are
 *     same-origin ('self'). If a future inline <script> is needed, use a nonce.
 *   * frame-ancestors 'none' — we are never framed (clickjacking defense).
 *   * frame-src allows Stripe so Checkout/redirect works.
 *   * HSTS is set; harmless on localhost (browsers ignore it over http).
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_WS = SUPABASE_URL.replace(/^https/, "wss");

const csp = [
  `default-src 'self'`,
  `script-src 'self' https://js.stripe.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https://*.stripe.com`,
  `font-src 'self' data:`,
  `connect-src 'self' ${SUPABASE_URL} ${SUPABASE_WS} https://api.stripe.com`,
  `frame-src https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self' https://checkout.stripe.com`,
  `object-src 'none'`,
]
  .join("; ")
  .replace(/\s+/g, " ")
  .trim();

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
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
