"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";

/**
 * tenant_admin: settle a pending invoice that was paid OUTSIDE Stripe (cash /
 * bank transfer). Posts to /api/manage/invoices/mark-paid; the server re-verifies
 * the invoice is in the caller's tenant and currently pending. Stripe-initiated
 * payments still flow through the webhook untouched.
 */
export function MarkPaidButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function markPaid() {
    setPending(true);
    const res = await fetch("/api/manage/invoices/mark-paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not mark as paid.");
      setPending(false);
      return;
    }
    toast.success("Marked as paid.");
    setPending(false);
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="text"
      size="sm"
      onClick={markPaid}
      disabled={pending}
    >
      {pending ? "Saving…" : "Mark paid"}
    </Button>
  );
}
