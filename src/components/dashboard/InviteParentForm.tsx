"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

type StudentRow = { fullName: string; className: string };

/**
 * tenant_admin: invite a parent and pre-create their child/children. Posts to
 * /api/manage/invite-parent; the 003 trigger links the students to the parent on
 * first login. tenant_id is server-derived from the caller — not sent here.
 */
export function InviteParentForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([{ fullName: "", className: "" }]);
  const [pending, setPending] = useState(false);

  function setStudent(i: number, patch: Partial<StudentRow>) {
    setStudents((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const payload = {
      email,
      students: students
        .filter((s) => s.fullName.trim())
        .map((s) => ({ fullName: s.fullName.trim(), className: s.className.trim() || undefined })),
    };
    const res = await fetch("/api/manage/invite-parent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not send the invitation.");
      setPending(false);
      return;
    }
    toast.success(
      data.emailSent ? "Parent invited." : "Invite saved — email failed to send.",
    );
    setEmail("");
    setStudents([{ fullName: "", className: "" }]);
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <TextField
        label="Parent email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="parent@example.com"
      />
      <div className="grid gap-3">
        <span className="text-xs font-medium text-on-surface-variant">Children</span>
        {students.map((s, i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <TextField
              label="Full name"
              value={s.fullName}
              onChange={(e) => setStudent(i, { fullName: e.target.value })}
              placeholder="Leo Hughes"
            />
            <TextField
              label="Class"
              value={s.className}
              onChange={(e) => setStudent(i, { className: e.target.value })}
              placeholder="3B"
            />
          </div>
        ))}
        <Button
          type="button"
          variant="text"
          onClick={() => setStudents((r) => [...r, { fullName: "", className: "" }])}
          className="justify-self-start"
        >
          + Add another child
        </Button>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Invite parent"}
      </Button>
    </form>
  );
}
