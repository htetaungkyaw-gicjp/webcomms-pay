"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/utils";

type Child = { id: string; full_name: string; class_name: string | null };
type Slot = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  teacher_class: string | null;
  starts_at: string;
  ends_at: string;
};

/**
 * Child-scoped booking (DESIGN.md signature element #3): pick the child first;
 * you only ever see slots for teachers who actually teach that child (matched by
 * class_name). This mirrors the Phase 4 server-side IDOR authorization — the UI
 * narrowing is convenience; the /api/appointments/book route re-authorizes.
 */
export function BookingPicker({
  slug,
  students,
  slots,
}: {
  slug: string;
  students: Child[];
  slots: Slot[];
}) {
  const router = useRouter();
  const [childId, setChildId] = useState(students[0]?.id ?? "");
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);

  const child = students.find((c) => c.id === childId);

  // Only slots whose teacher's class matches the child's class.
  const visibleSlots = useMemo(() => {
    if (!child) return [];
    return slots.filter(
      (s) => s.teacher_class && child.class_name && s.teacher_class === child.class_name,
    );
  }, [slots, child]);

  async function book(slotId: string) {
    if (!childId) return;
    setPendingSlot(slotId);
    const res = await fetch("/api/appointments/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, slotId, studentId: childId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(
        res.status === 409
          ? "That slot was just taken. Pick another."
          : data.error ?? "Could not book that slot.",
      );
      setPendingSlot(null);
      router.refresh();
      return;
    }
    toast.success("Meeting booked.");
    setPendingSlot(null);
    router.refresh();
  }

  if (students.length === 0) {
    return <p className="text-sm text-on-surface-variant">No children linked yet.</p>;
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <label className="text-xs font-medium text-on-surface-variant">Child</label>
        <select
          value={childId}
          onChange={(e) => setChildId(e.target.value)}
          className="h-12 rounded-t-[8px] border-0 border-b-2 border-outline bg-surface-container px-3 text-on-surface focus:border-primary outline-none"
        >
          {students.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
              {c.class_name ? ` (${c.class_name})` : ""}
            </option>
          ))}
        </select>
      </div>

      {!child?.class_name ? (
        <p className="text-sm text-on-surface-variant">
          This child has no class set, so no teacher meetings are available yet.
        </p>
      ) : visibleSlots.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          No available slots for {child.full_name}&apos;s class right now.
        </p>
      ) : (
        <ul className="grid gap-2">
          {visibleSlots.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-[12px] border border-outline-variant p-3"
            >
              <div>
                <div className="text-sm font-medium text-on-surface">{s.teacher_name}</div>
                <div className="text-xs text-on-surface-variant">
                  {formatDateTime(s.starts_at)}
                </div>
              </div>
              <Button
                variant="tonal"
                className="h-9 px-4 text-sm"
                disabled={pendingSlot === s.id}
                onClick={() => book(s.id)}
              >
                {pendingSlot === s.id ? "Booking…" : "Book"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
