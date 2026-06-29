import { redirect } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/dashboard/AppHeader";
import { StatTile } from "@/components/dashboard/StatTile";
import { Card, CardTitle } from "@/components/ui/Card";
import { NavPill } from "@/components/ui/NavPill";
import { CreateTenantForm } from "@/components/dashboard/CreateTenantForm";

/**
 * system_admin dashboard. RLS (tenants_select leads with system_admin OR) lets a
 * tenant-less system_admin read EVERY tenant — the role short-circuit. Lists all
 * tenants and offers a "create tenant + invite first admin" flow.
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
    .select("id, name, domain_slug, created_at")
    .order("name");

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 grid gap-6">
      <AppHeader role="system_admin" email={user.email} title="Platform admin" subtitle="system_admin" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="Tenants" value={tenants?.length ?? 0} tone="primary" />
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_360px]">
        <Card>
          <CardTitle>All tenants</CardTitle>
          <ul className="mt-4 divide-y divide-outline-variant">
            {tenants?.length ? (
              tenants.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-3">
                  <Link href={`/admin/tenants/${t.id}`} className="group">
                    <div className="font-medium text-on-surface group-hover:text-primary">
                      {t.name}
                    </div>
                    <code className="text-xs text-on-surface-variant">/{t.domain_slug}</code>
                  </Link>
                  <div className="flex items-center gap-1">
                    <NavPill href={`/admin/tenants/${t.id}`} tone="ghost">
                      Admins
                    </NavPill>
                    <NavPill
                      href={`/${t.domain_slug}/manage`}
                      tone="ghost"
                      className="text-primary hover:bg-primary/8"
                    >
                      Open
                    </NavPill>
                  </div>
                </li>
              ))
            ) : (
              <li className="py-6 text-sm text-on-surface-variant">No tenants yet.</li>
            )}
          </ul>
        </Card>

        <Card variant="tonal">
          <CardTitle>New tenant</CardTitle>
          <p className="mt-1 mb-4 text-sm text-on-surface-variant">
            Create a school/club and invite its first administrator.
          </p>
          <CreateTenantForm />
        </Card>
      </div>
    </main>
  );
}
