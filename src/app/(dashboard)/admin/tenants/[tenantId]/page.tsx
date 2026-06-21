import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/dashboard/AppHeader";
import { StatTile } from "@/components/dashboard/StatTile";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";

/**
 * system_admin: drill into a single tenant to see WHO its admins are (and a
 * count of parents + pending invites). RLS does the heavy lifting — profiles_select
 * and invitations_select both lead with the system_admin short-circuit, so a
 * tenant-less system_admin reads every tenant's members with the user-scoped
 * client (no admin client / IDOR surface here).
 */
export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
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

  // RLS: system_admin reads any tenant.
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, domain_slug")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) notFound();

  // RLS: system_admin reads all profiles; scope to this tenant in the query.
  const { data: members } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status")
    .eq("tenant_id", tenantId)
    .order("role");

  const { data: pendingInvites } = await supabase
    .from("invitations")
    .select("id, email, role, created_at, expires_at")
    .eq("tenant_id", tenantId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  const admins = (members ?? []).filter((m) => m.role === "tenant_admin");
  const parents = (members ?? []).filter((m) => m.role === "parent");

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 grid gap-6">
      <AppHeader
        role="system_admin"
        email={user.email}
        title={tenant.name}
        subtitle={`/${tenant.domain_slug}`}
        slug={tenant.domain_slug}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Admins" value={admins.length} tone="primary" />
        <StatTile label="Parents" value={parents.length} tone="secondary" />
        <StatTile label="Pending invites" value={pendingInvites?.length ?? 0} tone="neutral" />
        <div className="grid place-items-center rounded-[16px] bg-surface-container-high p-5">
          <Link
            href={`/${tenant.domain_slug}/manage`}
            className="rounded-full px-4 h-9 grid place-items-center text-sm font-medium text-primary hover:bg-primary/8"
          >
            Open manage →
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardTitle>Administrators</CardTitle>
          <ul className="mt-4 divide-y divide-outline-variant">
            {admins.length ? (
              admins.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium text-on-surface">
                      {a.full_name || a.email}
                    </div>
                    <div className="text-xs text-on-surface-variant">{a.email}</div>
                  </div>
                  <Chip tone={a.status === "active" ? "paid" : "void"}>
                    {a.status === "active" ? "Active" : "Disabled"}
                  </Chip>
                </li>
              ))
            ) : (
              <li className="py-6 text-sm text-on-surface-variant">
                No administrators yet.
              </li>
            )}
          </ul>
        </Card>

        <Card>
          <CardTitle>Pending invitations</CardTitle>
          <ul className="mt-4 divide-y divide-outline-variant">
            {pendingInvites?.length ? (
              pendingInvites.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium text-on-surface">{inv.email}</div>
                    <div className="text-xs text-on-surface-variant">{inv.role}</div>
                  </div>
                  <Chip tone="invited">Invited</Chip>
                </li>
              ))
            ) : (
              <li className="py-6 text-sm text-on-surface-variant">No pending invites.</li>
            )}
          </ul>
        </Card>
      </div>
    </main>
  );
}
