import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Tenant resolution + membership guard (DEFENSE IN DEPTH, not the boundary —
 * RLS is). Resolves the tenant by domain_slug and asserts the authenticated
 * caller either belongs to it with status='active', or is a system_admin.
 * Anything else → notFound() (fail closed).
 */
export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Resolve tenant. RLS: a member can read their own tenant; a system_admin all.
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, domain_slug")
    .eq("domain_slug", slug)
    .maybeSingle();
  if (!tenant) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status, tenant_id")
    .eq("id", user.id)
    .maybeSingle();

  const allowed =
    !!profile &&
    profile.status === "active" &&
    (profile.role === "system_admin" || profile.tenant_id === tenant.id);

  if (!allowed) notFound();

  return (
    <div style={{ padding: 32 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <strong>{tenant.name}</strong>
        <form action="/api/auth/signout" method="post">
          <button type="submit" style={{ padding: "4px 10px" }}>Sign out</button>
        </form>
      </header>
      <hr />
      {children}
    </div>
  );
}
