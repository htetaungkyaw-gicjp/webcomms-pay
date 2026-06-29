"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";

/** tenant_admin: create an appointment slot for a teacher. */
export function CreateSlotForm({
  teachers,
}: {
  teachers: { id: string; full_name: string; class_name: string | null }[];
}) {
  const router = useRouter();
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!teacherId || !startsAt || !endsAt) {
      toast.error("Pick a teacher and times.");
      return;
    }
    setPending(true);
    const res = await fetch("/api/manage/slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teacherId,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not create the slot.");
      setPending(false);
      return;
    }
    toast.success("Slot added.");
    setStartsAt("");
    setEndsAt("");
    setPending(false);
    router.refresh();
  }

  if (teachers.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant">Add a teacher first.</p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Select
        label="Teacher"
        value={teacherId}
        onChange={(e) => setTeacherId(e.target.value)}
      >
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.full_name}
            {t.class_name ? ` (${t.class_name})` : ""}
          </option>
        ))}
      </Select>
      <TextField
        label="Starts"
        type="datetime-local"
        required
        value={startsAt}
        onChange={(e) => setStartsAt(e.target.value)}
      />
      <TextField
        label="Ends"
        type="datetime-local"
        required
        value={endsAt}
        onChange={(e) => setEndsAt(e.target.value)}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add slot"}
      </Button>
    </form>
  );
}
