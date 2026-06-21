"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

/**
 * tenant_admin: invite another administrator into this tenant. Posts to
 * /api/manage/invite-admin; the 003 trigger binds them to this tenant with the
 * tenant_admin role on first sign-in. tenant_id is server-derived — not sent here.
 */
export function InviteAdminForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await fetch("/api/manage/invite-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not send the invitation.");
      setPending(false);
      return;
    }
    toast.success(data.emailSent ? "Admin invited." : "Invite saved — email failed to send.");
    setEmail("");
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <TextField
        label="Admin email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="colleague@example.com"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Invite admin"}
      </Button>
    </form>
  );
}
