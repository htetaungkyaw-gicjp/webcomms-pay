import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import { TopNav } from "@/components/dashboard/TopNav";
import { PortalNav } from "@/components/tenant/PortalNav";
import { Card, CardTitle } from "@/components/ui/Card";
import { InvoiceStatusChip } from "@/components/ui/Chip";
import { PayAllButton } from "@/components/tenant/PayAllButton";

/**
 * Parent portal home — child-first (DESIGN.md). RLS guarantees the parent sees
 * ONLY their own children and only invoices for those children.
 *
 *   1. "Needs you" rail — household-wide pending invoices collapsed into one
 *      list with a single Pay-all button naming the total.
 *   2. Per-child ledger cards — one card per child, outstanding balance as the
 *      hero number, that child's invoices as an inline ledger.
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, class_name")
    .order("full_name");

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, description, amount_cents, currency, status, student_id, created_at")
    .order("created_at");

  const allInvoices = invoices ?? [];
  const pending = allInvoices.filter((i) => i.status === "pending");
  const pendingIds = pending.map((i) => i.id);
  const currency = pending[0]?.currency ?? allInvoices[0]?.currency ?? "sgd";
  const total = pending.reduce((sum, i) => sum + i.amount_cents, 0);
  const nameById = new Map((students ?? []).map((s) => [s.id, s.full_name]));

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6 grid gap-6">
      <TopNav title="Your family" email={user?.email} subtitle={slug} />
      <PortalNav slug={slug} active="home" />

      {/* 1. "Needs you" hero rail — primary-container. */}
      <section className="rounded-[28px] bg-primary-container p-6 text-on-primary-container">
        <h2 className="font-display text-lg font-medium">Needs you</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm opacity-80">
            You&apos;re all caught up — nothing to pay. 🎉
          </p>
        ) : (
          <>
            <ul className="mt-3 grid gap-2">
              {pending.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between text-sm">
                  <span>
                    {inv.description}
                    <span className="opacity-70">
                      {" "}
                      · {nameById.get(inv.student_id ?? "") ?? "—"}
                    </span>
                  </span>
                  <span className="tabular font-medium">
                    {formatMoney(inv.amount_cents, inv.currency)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex items-center justify-between gap-4">
              <span className="tabular font-display text-2xl font-medium">
                {formatMoney(total, currency)}
              </span>
              <PayAllButton
                slug={slug}
                invoiceIds={pendingIds}
                label={`Pay all ${formatMoney(total, currency)}`}
              />
            </div>
          </>
        )}
      </section>

      {/* 2. Per-child ledger cards. */}
      <div className="grid gap-4">
        {students?.length ? (
          students.map((child) => {
            const childInvoices = allInvoices.filter((i) => i.student_id === child.id);
            const owed = childInvoices
              .filter((i) => i.status === "pending")
              .reduce((s, i) => s + i.amount_cents, 0);
            return (
              <Card key={child.id}>
                <div className="flex items-baseline justify-between">
                  <CardTitle>{child.full_name}</CardTitle>
                  <span className="text-xs text-on-surface-variant">
                    {child.class_name ?? "—"}
                  </span>
                </div>
                <div className="mt-2 tabular font-display text-2xl font-medium text-on-surface">
                  {formatMoney(owed, currency)}{" "}
                  <span className="text-sm font-normal text-on-surface-variant">
                    outstanding
                  </span>
                </div>
                <ul className="mt-4 divide-y divide-outline-variant">
                  {childInvoices.length ? (
                    childInvoices.map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between py-2 text-sm">
                        <span>{inv.description}</span>
                        <span className="flex items-center gap-3">
                          <span className="tabular">
                            {formatMoney(inv.amount_cents, inv.currency)}
                          </span>
                          <InvoiceStatusChip status={inv.status} />
                        </span>
                      </li>
                    ))
                  ) : (
                    <li className="py-2 text-sm text-on-surface-variant">No invoices.</li>
                  )}
                </ul>
              </Card>
            );
          })
        ) : (
          <Card>
            <p className="text-sm text-on-surface-variant">
              No children linked yet. If your school just invited you, your
              child(ren) will appear here.
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}
