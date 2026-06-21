import { createClient } from "@/lib/supabase/server";
import { getHeaderContext } from "@/lib/auth-guards";
import { AppHeader } from "@/components/dashboard/AppHeader";
import { ManageNav } from "@/components/dashboard/ManageNav";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { InviteAdminForm } from "@/components/dashboard/InviteAdminForm";

/**
 * tenant_admin: see this tenant's administrators and invite another. RLS scopes
 * the reads — profiles_select returns the tenant's profiles to a tenant_admin,
 * and invitations_select the tenant's invitations. The invite form posts to
 * /api/manage/invite-admin (tenant_id server-derived).
 */
export default async function ManageAdminsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { email, role } = await getHeaderContext(supabase);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, status")
    .eq("role", "tenant_admin")
    .order("full_name");

  const { data: pendingInvites } = await supabase
    .from("invitations")
    .select("id, email, role, created_at")
    .eq("role", "tenant_admin")
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 grid gap-6">
      <AppHeader role={role ?? "tenant_admin"} email={email} title="Admins" subtitle={slug} slug={slug} />
      <ManageNav slug={slug} active="admins" />

      <div className="grid gap-6 md:grid-cols-[1fr_360px]">
        <Card>
          <CardTitle>Administrators</CardTitle>
          <ul className="mt-4 divide-y divide-outline-variant">
            {profiles?.length ? (
              profiles.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium text-on-surface">{a.full_name || a.email}</div>
                    <div className="text-xs text-on-surface-variant">{a.email}</div>
                  </div>
                  <Chip tone={a.status === "active" ? "paid" : "void"}>
                    {a.status === "active" ? "Active" : "Disabled"}
                  </Chip>
                </li>
              ))
            ) : (
              <li className="py-6 text-sm text-on-surface-variant">No administrators yet.</li>
            )}
          </ul>

          {pendingInvites?.length ? (
            <div className="mt-6 border-t border-outline-variant pt-4">
              <div className="mb-2 text-xs font-medium text-on-surface-variant">
                Pending admin invites
              </div>
              <ul className="divide-y divide-outline-variant">
                {pendingInvites.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between py-2">
                    <span className="text-sm text-on-surface">{inv.email}</span>
                    <Chip tone="invited">Invited</Chip>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card variant="tonal">
          <CardTitle>Invite an admin</CardTitle>
          <p className="mt-1 mb-4 text-sm text-on-surface-variant">
            They confirm with a one-time code on first sign-in and join this tenant as an
            administrator.
          </p>
          <InviteAdminForm />
        </Card>
      </div>
    </main>
  );
}
