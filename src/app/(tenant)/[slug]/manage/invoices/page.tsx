import { createClient } from "@/lib/supabase/server";
import { getHeaderContext } from "@/lib/auth-guards";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { AppHeader } from "@/components/dashboard/AppHeader";
import { ManageNav } from "@/components/dashboard/ManageNav";
import { StatTile } from "@/components/dashboard/StatTile";
import { Card, CardTitle } from "@/components/ui/Card";
import { InvoiceStatusChip } from "@/components/ui/Chip";
import { CreateInvoiceForm } from "@/components/dashboard/CreateInvoiceForm";
import { MarkPaidButton } from "@/components/dashboard/MarkPaidButton";

export default async function ManageInvoicesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { email, role } = await getHeaderContext(supabase);

  // RLS scopes both to the caller's tenant.
  const { data: students } = await supabase
    .from("students")
    .select("id, full_name")
    .order("full_name");

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, description, amount_cents, currency, status, student_id, created_at, paid_at")
    .order("created_at", { ascending: false });

  const nameById = new Map((students ?? []).map((s) => [s.id, s.full_name]));

  // Payment summary (derived from the rows we already fetched).
  const currency = invoices?.[0]?.currency ?? "sgd";
  const paidTotal = (invoices ?? [])
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount_cents, 0);
  const pending = (invoices ?? []).filter((i) => i.status === "pending");
  const outstanding = pending.reduce((sum, i) => sum + i.amount_cents, 0);

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 grid gap-6">
      <AppHeader role={role ?? "tenant_admin"} email={email} title="Invoices" subtitle={slug} slug={slug} />
      <ManageNav slug={slug} active="invoices" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatTile label="Paid" value={formatMoney(paidTotal, currency)} tone="primary" />
        <StatTile label="Outstanding" value={formatMoney(outstanding, currency)} tone="tertiary" />
        <StatTile label="Pending" value={pending.length} tone="neutral" />
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_360px]">
        <Card>
          <CardTitle>All invoices</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-on-surface-variant">
                <tr>
                  <th className="py-2 pr-4 font-medium">Child</th>
                  <th className="py-2 pr-4 font-medium">Description</th>
                  <th className="py-2 pr-4 font-medium text-right">Amount</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium text-right">Settle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {invoices?.length ? (
                  invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-2 pr-4">{nameById.get(inv.student_id ?? "") ?? "—"}</td>
                      <td className="py-2 pr-4">{inv.description}</td>
                      <td className="py-2 pr-4 text-right tabular">
                        {formatMoney(inv.amount_cents, inv.currency)}
                      </td>
                      <td className="py-2 pr-4">
                        <InvoiceStatusChip status={inv.status} />
                        {inv.paid_at && (
                          <span className="ml-2 text-xs text-on-surface-variant">
                            {formatDateTime(inv.paid_at)}
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {inv.status === "pending" && <MarkPaidButton invoiceId={inv.id} />}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-on-surface-variant">
                      No invoices yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card variant="tonal">
          <CardTitle>New invoice</CardTitle>
          <div className="mt-4">
            <CreateInvoiceForm students={students ?? []} />
          </div>
        </Card>
      </div>
    </main>
  );
}
