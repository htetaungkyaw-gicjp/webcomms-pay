import { createClient } from "@/lib/supabase/server";
import { getHeaderContext } from "@/lib/auth-guards";
import { formatDateTime } from "@/lib/utils";
import { AppHeader } from "@/components/dashboard/AppHeader";
import { PortalNav } from "@/components/tenant/PortalNav";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { BookingPicker } from "@/components/tenant/BookingPicker";

/**
 * Book a parent-teacher meeting (DESIGN.md). Child-scoped: the picker only shows
 * slots for teachers whose class matches the selected child. Availability is
 * DERIVED — a slot is free iff no non-cancelled appointment references it (no
 * is_booked flag). The booking itself is authorized server-side in Phase 4's
 * /api/appointments/book (this UI narrowing is convenience, not the boundary).
 */
export default async function PortalBookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { role } = await getHeaderContext(supabase);

  const { data: children } = await supabase
    .from("students")
    .select("id, full_name, class_name")
    .order("full_name");

  const { data: rawSlots } = await supabase
    .from("appointment_slots")
    .select("id, teacher_id, starts_at, ends_at, teachers(full_name, class_name)")
    .order("starts_at");

  // Derived availability: drop slots with a non-cancelled appointment.
  const { data: booked } = await supabase
    .from("appointments")
    .select("slot_id")
    .neq("status", "cancelled");
  const bookedSet = new Set((booked ?? []).map((b) => b.slot_id));

  type SlotRow = NonNullable<typeof rawSlots>[number];
  const available = (rawSlots ?? [])
    .filter((s: SlotRow) => !bookedSet.has(s.id) && new Date(s.starts_at) > new Date())
    .map((s: SlotRow) => ({
      id: s.id,
      teacher_id: s.teacher_id,
      teacher_name: s.teachers?.full_name ?? "Teacher",
      teacher_class: s.teachers?.class_name ?? null,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
    }));

  // This parent's own appointments (RLS: parent sees own).
  const { data: myAppointments } = await supabase
    .from("appointments")
    .select("id, status, slot_id, student_id, appointment_slots(starts_at), students(full_name)")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6 grid gap-6">
      <AppHeader role={role ?? "parent"} email={user?.email} title="Book a meeting" subtitle={slug} slug={slug} />
      <PortalNav slug={slug} active="book" />

      <Card variant="tonal">
        <CardTitle>Find a slot</CardTitle>
        <p className="mt-1 mb-4 text-sm text-on-surface-variant">
          Choose your child, then pick a time with their teacher.
        </p>
        <BookingPicker slug={slug} students={children ?? []} slots={available} />
      </Card>

      <Card>
        <CardTitle>Your meetings</CardTitle>
        <ul className="mt-4 divide-y divide-outline-variant">
          {myAppointments?.length ? (
            myAppointments.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {a.students?.full_name ?? "—"}
                  <span className="text-on-surface-variant">
                    {" "}
                    · {a.appointment_slots?.starts_at ? formatDateTime(a.appointment_slots.starts_at) : ""}
                  </span>
                </span>
                <Chip tone={a.status === "confirmed" ? "paid" : "invited"}>
                  {a.status}
                </Chip>
              </li>
            ))
          ) : (
            <li className="py-2 text-sm text-on-surface-variant">No meetings booked.</li>
          )}
        </ul>
      </Card>
    </main>
  );
}
