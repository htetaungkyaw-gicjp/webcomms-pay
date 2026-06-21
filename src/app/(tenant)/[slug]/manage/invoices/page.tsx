import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import { TopNav } from "@/components/dashboard/TopNav";
import { ManageNav } from "@/components/dashboard/ManageNav";
import { Card, CardTitle } from "@/components/ui/Card";
import { InvoiceStatusChip } from "@/components/ui/Chip";
import { CreateInvoiceForm } from "@/components/dashboard/CreateInvoiceForm";

export default async function ManageInvoicesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS scopes both to the caller's tenant.
  const { data: students } = await supabase
    .from("students")
    .select("id, full_name")
    .order("full_name");

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, description, amount_cents, currency, status, student_id, created_at")
    .order("created_at", { ascending: false });

  const nameById = new Map((students ?? []).map((s) => [s.id, s.full_name]));

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 grid gap-6">
      <TopNav title="Invoices" email={user?.email} subtitle={slug} />
      <ManageNav slug={slug} active="invoices" />

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
                  <th className="py-2 font-medium">Status</th>
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
                      <td className="py-2">
                        <InvoiceStatusChip status={inv.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-on-surface-variant">
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
