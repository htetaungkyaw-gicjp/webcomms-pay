"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

/** tenant_admin: add a teacher (class_name ties them to a class's students). */
export function CreateTeacherForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [className, setClassName] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await fetch("/api/manage/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, className: className || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not add the teacher.");
      setPending(false);
      return;
    }
    toast.success("Teacher added.");
    setFullName("");
    setClassName("");
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <TextField
        label="Teacher name"
        required
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        placeholder="Ms Okafor"
      />
      <TextField
        label="Class"
        value={className}
        onChange={(e) => setClassName(e.target.value)}
        placeholder="3B"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add teacher"}
      </Button>
    </form>
  );
}
