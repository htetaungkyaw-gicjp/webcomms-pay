"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

/** tenant_admin: post an announcement. Server sanitizes input to plain text. */
export function CreateAnnouncementForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await fetch("/api/manage/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, isUrgent }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not post.");
      setPending(false);
      return;
    }
    toast.success("Announcement posted.");
    setTitle("");
    setBody("");
    setIsUrgent(false);
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <TextField
        label="Title"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Sports day moved to Friday"
      />
      <div className="grid gap-1">
        <label className="text-xs font-medium text-on-surface-variant">Message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="rounded-t-[8px] border-0 border-b-2 border-outline bg-surface-container px-3 py-2 text-on-surface focus:border-primary outline-none"
          placeholder="Details for parents…"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isUrgent}
          onChange={(e) => setIsUrgent(e.target.checked)}
        />
        Mark as urgent
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Posting…" : "Post announcement"}
      </Button>
    </form>
  );
}
