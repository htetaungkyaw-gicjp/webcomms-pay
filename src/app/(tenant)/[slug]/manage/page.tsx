import { createClient } from "@/lib/supabase/server";

/**
 * tenant_admin landing (Phase 0 stub). RLS scopes every read to this admin's
 * tenant automatically. Full CRUD lands in Phase 3.
 */
export default async function ManagePage() {
  const supabase = await createClient();

  // RLS returns only this tenant's students.
  const { data: students } = await supabase
    .from("students")
    .select("full_name, class_name, parent_email, parent_id")
    .order("full_name");

  const { data: invoices } = await supabase
    .from("invoices")
    .select("description, amount_cents, currency, status")
    .order("created_at");

  return (
    <main>
      <h1>Manage</h1>
      <h2>Students ({students?.length ?? 0})</h2>
      <ul>
        {students?.map((s, i) => (
          <li key={i}>
            {s.full_name} ({s.class_name ?? "—"}) — {s.parent_email}{" "}
            {s.parent_id ? "✓ linked" : "⏳ pending first login"}
          </li>
        ))}
      </ul>
      <h2>Invoices ({invoices?.length ?? 0})</h2>
      <ul>
        {invoices?.map((inv, i) => (
          <li key={i}>
            {inv.description} — {inv.amount_cents / 100} {inv.currency.toUpperCase()} [{inv.status}]
          </li>
        ))}
      </ul>
    </main>
  );
}
