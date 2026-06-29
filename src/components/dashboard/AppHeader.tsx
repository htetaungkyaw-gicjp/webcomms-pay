import Link from "next/link";

import type { Database } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { NavPill } from "@/components/ui/NavPill";

type Role = Database["public"]["Enums"]["user_role"];

/**
 * Unified, role-aware app header (server component). Replaces the bare TopNav so
 * every role gets the same shell: wordmark · role badge · contextual links ·
 * signed-in email · sign-out. Section navs (ManageNav/PortalNav) still render
 * below this. Logout is a real POST form so it works without JS (carried over
 * from TopNav).
 *
 * `role` is the caller's profile role (server-derived); `slug` is the tenant in
 * context (omit on the platform `/admin` view). Links are computed from role so
 * a parent never sees a manage link, etc.
 */
const ROLE_BADGE: Record<Role, string> = {
  system_admin: "System",
  tenant_admin: "Admin",
  parent: "Parent",
};

type NavLink = { href: string; label: string };

function linksFor(role: Role, slug?: string): NavLink[] {
  const links: NavLink[] = [];
  if (role === "system_admin") {
    links.push({ href: "/admin", label: "Tenants" });
    if (slug) {
      links.push({ href: `/${slug}/manage`, label: "Manage" });
      links.push({ href: `/${slug}/portal`, label: "Portal" });
    }
  } else if (role === "tenant_admin" && slug) {
    links.push({ href: `/${slug}/manage`, label: "Manage" });
  } else if (role === "parent" && slug) {
    links.push({ href: `/${slug}/portal`, label: "Portal" });
  }
  return links;
}

export function AppHeader({
  role,
  email,
  title,
  subtitle,
  slug,
}: {
  role: Role;
  email?: string | null;
  title: string;
  subtitle?: string;
  slug?: string;
}) {
  const links = linksFor(role, slug);

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-md bg-surface-container px-5 py-3">
      <div className="flex items-center gap-3">
        <Link href="/" className="font-display text-lg font-medium text-on-surface">
          WebComms&nbsp;&amp;&nbsp;Pay
        </Link>
        <span className="inline-flex items-center rounded-full bg-primary-container px-3 py-1 text-xs font-medium text-on-primary-container">
          {ROLE_BADGE[role]}
        </span>
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
        {links.length > 0 && (
          <nav className="flex flex-wrap items-center gap-1">
            {links.map((l) => (
              <NavPill key={l.href} href={l.href} tone="ghost" className="px-3">
                {l.label}
              </NavPill>
            ))}
          </nav>
        )}
        {email && (
          <span className="hidden text-sm text-on-surface-variant sm:inline">{email}</span>
        )}
        <form action="/api/auth/signout" method="post">
          <Button type="submit" variant="text" size="sm">
            Sign out
          </Button>
        </form>
      </div>

      {(title || subtitle) && (
        <div className="w-full">
          <h1 className="font-display text-xl font-medium text-on-surface">{title}</h1>
          {subtitle && <p className="text-xs text-on-surface-variant">{subtitle}</p>}
        </div>
      )}
    </header>
  );
}
