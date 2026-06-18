import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * system_admin dashboard. Proves the role short-circuit: a system_admin has
 * tenant_id = NULL yet RLS (tenants_select leads with system_admin OR) lets
 * them read EVERY tenant.
 */
export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status === "disabled" || profile.role !== "system_admin") {
    redirect("/login");
  }

  // RLS returns ALL tenants for a system_admin.
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, domain_slug")
    .order("name");

  return (
    <main style={{ padding: 32 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1>Platform admin</h1>
        <form action="/api/auth/signout" method="post">
          <button type="submit">Sign out</button>
        </form>
      </header>
      <p>Signed in as {user.email} (system_admin)</p>
      <h2>All tenants ({tenants?.length ?? 0})</h2>
      <ul>
        {tenants?.map((t) => (
          <li key={t.id}>
            {t.name} — <code>/{t.domain_slug}</code>
          </li>
        ))}
      </ul>
    </main>
  );
}
