"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";

/**
 * Posts the caller's pending invoice ids to /api/stripe/checkout and redirects
 * to the returned Stripe Checkout URL. The ids are used ONLY as a filter — the
 * server re-verifies ownership and reads amounts from the DB (never trusts the
 * client). See PLAN.md §Phase 4. The button names the total (DESIGN.md tone).
 */
export function PayAllButton({
  slug,
  invoiceIds,
  label = "Pay all",
}: {
  slug: string;
  invoiceIds: string[];
  label?: string;
}) {
  const [pending, setPending] = useState(false);

  async function pay() {
    setPending(true);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, invoiceIds }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? `Checkout failed (${res.status}).`);
      setPending(false);
      return;
    }
    const { url } = await res.json();
    window.location.href = url;
  }

  if (invoiceIds.length === 0) {
    return <p className="text-sm text-on-surface-variant">Nothing outstanding. 🎉</p>;
  }

  return (
    <Button onClick={pay} disabled={pending}>
      {pending ? "Redirecting…" : label}
    </Button>
  );
}
