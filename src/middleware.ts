import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/**
 * Per-request Content-Security-Policy with a nonce.
 *
 * The CSP lives HERE (not next.config.ts headers()) because Next only stamps a
 * nonce onto its own inline framework/hydration scripts when it sees the policy
 * arrive via a request header named `x-nonce` set in middleware. Static headers
 * from next.config can't carry a per-request value. With Turbopack's production
 * output emitting inline bootstrap scripts, `script-src 'self'` alone blocks
 * hydration entirely — the nonce is what lets Next's scripts run while arbitrary
 * injected inline scripts (stored-XSS from tenant announcements) stay blocked.
 *
 * The allowlisted third-party origins are unchanged from the prior config:
 *   * Stripe.js (js.stripe.com) + Checkout iframe (checkout.stripe.com)
 *   * Supabase  (the project REST/Auth origin, from NEXT_PUBLIC_SUPABASE_URL)
 */
function buildCsp(nonce: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseWs = supabaseUrl.replace(/^https/, "wss");
  return [
    `default-src 'self'`,
    // 'strict-dynamic' is the documented recipe for nonce-based CSP in Next: the
    // nonced bootstrap script is trusted to load the chunk scripts it injects.
    // Note: under 'strict-dynamic' browsers IGNORE host allowlists in script-src
    // ('self', js.stripe.com) — only the nonce + scripts it loads run. Stripe.js
    // is pulled in by the nonced Next bundle, so that trust propagates. The
    // host entries are kept as a fallback for browsers without strict-dynamic.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://*.stripe.com`,
    `font-src 'self' data:`,
    `connect-src 'self' ${supabaseUrl} ${supabaseWs} https://api.stripe.com`,
    `frame-src https://js.stripe.com https://checkout.stripe.com https://hooks.stripe.com`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self' https://checkout.stripe.com`,
    `object-src 'none'`,
  ]
    .join("; ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Session refresh + route guard + CSP.
 *
 *   * Sets a per-request nonce'd CSP (see buildCsp above).
 *   * Refreshes the Supabase session on every matched request (cookie rotation).
 *   * Guards /admin, /manage, /portal: no user → redirect to /login.
 *   * The /api/stripe/webhook route is EXCLUDED from the matcher so the raw body
 *     survives for signature verification (see config.matcher below).
 *
 * This is a coarse guard. The real tenant boundary is RLS; (tenant)/[slug]/
 * layout.tsx adds a membership check as defense-in-depth.
 */
export async function middleware(request: NextRequest) {
  // Per-request nonce. crypto.randomUUID is available in the Edge runtime.
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  // Pass the nonce + CSP INTO the request so Next stamps the nonce onto its
  // inline scripts during render; also echo the CSP on the response headers.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.headers.set("Content-Security-Policy", csp);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() (not getSession) — it revalidates the JWT with the
  // auth server. Do not run any code between createServerClient and getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected =
    pathname.startsWith("/admin") ||
    pathname.includes("/manage") ||
    pathname.includes("/portal");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  }

  return response;
}

export const config = {
  // Match everything EXCEPT: Next internals, static assets, AND the Stripe
  // webhook (raw body must be preserved for signature verification).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
