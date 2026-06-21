"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";

/**
 * "Noted" — records the parent's acknowledgement. parent_id is set SERVER-SIDE
 * from auth.uid() (never sent from the client); the immutable INSERT-only ack
 * RLS is the boundary. Idempotent on the server (unique constraint).
 */
export function AckButton({
  announcementId,
  acknowledged,
}: {
  announcementId: string;
  acknowledged: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(acknowledged);
  const [pending, setPending] = useState(false);

  if (done) {
    return <span className="text-xs font-medium text-on-surface-variant">✓ Noted</span>;
  }

  async function ack() {
    setPending(true);
    const res = await fetch("/api/announcements/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ announcementId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Could not record that.");
      setPending(false);
      return;
    }
    setDone(true);
    setPending(false);
    router.refresh();
  }

  return (
    <Button variant="tonal" onClick={ack} disabled={pending} className="h-8 px-4 text-xs">
      {pending ? "…" : "Noted"}
    </Button>
  );
}
