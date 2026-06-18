import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/**
 * Session refresh + route guard.
 *
 *   * Refreshes the Supabase session on every matched request (cookie rotation).
 *   * Guards /admin, /manage, /portal: no user → redirect to /login.
 *   * The /api/stripe/webhook route is EXCLUDED from the matcher so the raw body
 *     survives for signature verification (see config.matcher below).
 *
 * This is a coarse guard. The real tenant boundary is RLS; (tenant)/[slug]/
 * layout.tsx adds a membership check as defense-in-depth.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
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
    return NextResponse.redirect(url);
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
