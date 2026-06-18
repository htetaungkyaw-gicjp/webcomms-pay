import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import { PayAllButton } from "@/components/tenant/PayAllButton";

/**
 * Parent portal — Payments tab (Phase 0). RLS guarantees the parent sees ONLY
 * invoices for their own children (invoices_select subselects students where
 * parent_id = auth.uid()). A Tenant B invoice id is simply not returned.
 *
 * The pre-created student linked by the 003 trigger appears here on first login.
 */
export default async function PortalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  // RLS: only this parent's children.
  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, class_name")
    .order("full_name");

  // RLS: only invoices for this parent's children.
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, description, amount_cents, currency, status, student_id")
    .order("created_at");

  const pending = (invoices ?? []).filter((i) => i.status === "pending");
  const pendingIds = pending.map((i) => i.id);

  return (
    <main>
      <h1>Payments</h1>

      <h2>Your children ({students?.length ?? 0})</h2>
      <ul>
        {students?.map((s) => (
          <li key={s.id}>
            {s.full_name} ({s.class_name ?? "—"})
          </li>
        ))}
      </ul>

      <h2>Invoices ({invoices?.length ?? 0})</h2>
      <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Description</th>
            <th align="right">Amount</th>
            <th align="left">Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices?.map((inv) => (
            <tr key={inv.id}>
              <td>{inv.description}</td>
              <td align="right">{formatMoney(inv.amount_cents, inv.currency)}</td>
              <td>{inv.status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Pay</h2>
      <PayAllButton slug={slug} invoiceIds={pendingIds} />
    </main>
  );
}
