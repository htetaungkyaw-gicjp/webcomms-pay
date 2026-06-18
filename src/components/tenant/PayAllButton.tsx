"use client";

import { useState } from "react";

/**
 * Posts the caller's pending invoice ids to /api/stripe/checkout and redirects
 * to the returned Stripe Checkout URL. The ids are used ONLY as a filter — the
 * server re-verifies ownership and reads amounts from the DB (never trusts the
 * client). See PLAN.md §Phase 4.
 */
export function PayAllButton({
  slug,
  invoiceIds,
}: {
  slug: string;
  invoiceIds: string[];
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, invoiceIds }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `Checkout failed (${res.status}).`);
      setPending(false);
      return;
    }
    const { url } = await res.json();
    window.location.href = url;
  }

  if (invoiceIds.length === 0) return <p>Nothing outstanding. 🎉</p>;

  return (
    <div>
      <button onClick={pay} disabled={pending} style={{ padding: 10 }}>
        {pending ? "Redirecting…" : `Pay all (${invoiceIds.length})`}
      </button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
