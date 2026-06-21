import { createClient } from "@/lib/supabase/server";
import { getHeaderContext } from "@/lib/auth-guards";
import { formatMoney } from "@/lib/utils";
import { AppHeader } from "@/components/dashboard/AppHeader";
import { StatTile } from "@/components/dashboard/StatTile";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { InviteParentForm } from "@/components/dashboard/InviteParentForm";
import { ManageNav } from "@/components/dashboard/ManageNav";

/**
 * tenant_admin hub (Phase 2). RLS scopes every read to this admin's tenant. The
 * full per-section CRUD (invoices, announcements, calendar, slots) lives under
 * the ManageNav sub-routes (Phase 3); this overview shows the headline numbers,
 * the families list with link/pending status, and the invite-parent flow.
 */
export default async function ManagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { email, role } = await getHeaderContext(supabase);

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, class_name, parent_email, parent_id")
    .order("full_name");

  const { data: invoices } = await supabase
    .from("invoices")
    .select("amount_cents, currency, status");

  const { data: pendingInvites } = await supabase
    .from("invitations")
    .select("id")
    .is("accepted_at", null);

  const outstanding = (invoices ?? [])
    .filter((i) => i.status === "pending")
    .reduce((sum, i) => sum + i.amount_cents, 0);
  const currency = invoices?.[0]?.currency ?? "sgd";

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 grid gap-6">
      <AppHeader role={role ?? "tenant_admin"} email={email} title="Manage" subtitle={slug} slug={slug} />
      <ManageNav slug={slug} active="overview" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Children" value={students?.length ?? 0} tone="primary" />
        <StatTile
          label="Outstanding"
          value={formatMoney(outstanding, currency)}
          tone="tertiary"
        />
        <StatTile label="Invoices" value={invoices?.length ?? 0} tone="secondary" />
        <StatTile label="Pending invites" value={pendingInvites?.length ?? 0} tone="neutral" />
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_360px]">
        <Card>
          <CardTitle>Families</CardTitle>
          <ul className="mt-4 divide-y divide-outline-variant">
            {students?.length ? (
              students.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium text-on-surface">{s.full_name}</div>
                    <div className="text-xs text-on-surface-variant">
                      {s.class_name ?? "—"} · {s.parent_email ?? "no parent email"}
                    </div>
                  </div>
                  {s.parent_id ? (
                    <Chip tone="paid">Linked</Chip>
                  ) : (
                    <Chip tone="invited">Invited</Chip>
                  )}
                </li>
              ))
            ) : (
              <li className="py-6 text-sm text-on-surface-variant">
                No children yet — invite a parent to add their child.
              </li>
            )}
          </ul>
        </Card>

        <Card variant="tonal">
          <CardTitle>Invite a parent</CardTitle>
          <p className="mt-1 mb-4 text-sm text-on-surface-variant">
            Add their child now; the child links to the parent on first sign-in.
          </p>
          <InviteParentForm />
        </Card>
      </div>
    </main>
  );
}
