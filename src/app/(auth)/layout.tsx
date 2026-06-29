/**
 * Auth group layout — forces dynamic rendering for every (auth) page
 * (login, verify, accept-invite).
 *
 * WHY: the app uses a nonce-based CSP built per-request in src/middleware.ts.
 * Next stamps that per-request nonce onto its inline hydration/RSC scripts ONLY
 * during server-side rendering, by reading the Content-Security-Policy request
 * header. A statically PRERENDERED page is baked at build time with no request
 * headers, so its inline scripts carry no nonce — the runtime CSP header then
 * blocks the page's own scripts and the client forms never hydrate (the login
 * button silently does nothing). Forcing dynamic rendering makes every auth page
 * render per-request so the nonce is applied.
 *
 * See: https://nextjs.org/docs/app/guides/content-security-policy
 *      ("How nonces work in Next.js" / "Forcing dynamic rendering")
 */
export const dynamic = "force-dynamic";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Soft ambient wash behind the centered auth card (Antigravity-style).
  return <div className="hero-wash min-h-screen">{children}</div>;
}
