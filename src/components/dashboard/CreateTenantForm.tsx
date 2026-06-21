"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

/**
 * system_admin: create a tenant and optionally invite its first tenant_admin.
 * Posts to /api/admin/tenants — the server assigns tenant_id (never the client).
 */
export function CreateTenantForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, adminEmail: adminEmail || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not create the tenant.");
      setPending(false);
      return;
    }
    toast.success(
      data.invited
        ? data.invited.emailSent
          ? "Tenant created and admin invited."
          : "Tenant created — invite saved but email failed to send."
        : "Tenant created.",
    );
    setName("");
    setSlug("");
    setAdminEmail("");
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <TextField
        label="Tenant name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Greenwood Primary"
      />
      <TextField
        label="URL slug"
        required
        value={slug}
        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
        placeholder="greenwood"
      />
      <TextField
        label="First admin email (optional)"
        type="email"
        value={adminEmail}
        onChange={(e) => setAdminEmail(e.target.value)}
        placeholder="head@greenwood.example"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create tenant"}
      </Button>
    </form>
  );
}
