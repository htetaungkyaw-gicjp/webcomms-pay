"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

const TYPES = ["general", "holiday", "exam", "activity", "meeting"] as const;

/** tenant_admin: create a calendar event. datetime-local → ISO on submit. */
export function CreateEventForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<(typeof TYPES)[number]>("general");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startsAt || !endsAt) {
      toast.error("Pick start and end times.");
      return;
    }
    setPending(true);
    const res = await fetch("/api/manage/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        eventType,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Could not create the event.");
      setPending(false);
      return;
    }
    toast.success("Event added.");
    setTitle("");
    setStartsAt("");
    setEndsAt("");
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
        placeholder="Parents' evening"
      />
      <div className="grid gap-1">
        <label className="text-xs font-medium text-on-surface-variant">Type</label>
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value as (typeof TYPES)[number])}
          className="h-12 rounded-t-[8px] border-0 border-b-2 border-outline bg-surface-container px-3 text-on-surface focus:border-primary outline-none"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
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
        {pending ? "Adding…" : "Add event"}
      </Button>
    </form>
  );
}
