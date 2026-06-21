"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

/** tenant_admin: create an invoice for one of the tenant's students. */
export function CreateInvoiceForm({
  students,
}: {
  students: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!studentId || !Number.isFinite(amountCents) || amountCents < 1) {
      toast.error("Pick a child and a valid amount.");
      return;
    }
    setPending(true);
    const res = await fetch("/api/manage/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, description, amountCents }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not create the invoice.");
      setPending(false);
      return;
    }
    toast.success("Invoice created.");
    setDescription("");
    setAmount("");
    setPending(false);
    router.refresh();
  }

  if (students.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant">
        Add a child first (invite a parent) before creating invoices.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-1">
        <label className="text-xs font-medium text-on-surface-variant">Child</label>
        <select
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          className="h-12 rounded-t-[8px] border-0 border-b-2 border-outline bg-surface-container px-3 text-on-surface focus:border-primary outline-none"
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
      </div>
      <TextField
        label="Description"
        required
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Term 1 tuition"
      />
      <TextField
        label="Amount"
        inputMode="decimal"
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="120.00"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create invoice"}
      </Button>
    </form>
  );
}
