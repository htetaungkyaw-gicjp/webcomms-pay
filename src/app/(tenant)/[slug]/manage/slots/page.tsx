import { createClient } from "@/lib/supabase/server";
import { getHeaderContext } from "@/lib/auth-guards";
import { formatDateTime } from "@/lib/utils";
import { AppHeader } from "@/components/dashboard/AppHeader";
import { ManageNav } from "@/components/dashboard/ManageNav";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { CreateTeacherForm } from "@/components/dashboard/CreateTeacherForm";
import { CreateSlotForm } from "@/components/dashboard/CreateSlotForm";

export default async function ManageSlotsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { email, role } = await getHeaderContext(supabase);

  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, full_name, class_name")
    .order("full_name");

  const { data: slots } = await supabase
    .from("appointment_slots")
    .select("id, teacher_id, starts_at, ends_at")
    .order("starts_at", { ascending: true });

  // Which slots already have a non-cancelled appointment (derived availability).
  const { data: booked } = await supabase
    .from("appointments")
    .select("slot_id")
    .neq("status", "cancelled");
  const bookedSet = new Set((booked ?? []).map((b) => b.slot_id));
  const teacherById = new Map((teachers ?? []).map((t) => [t.id, t]));

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 grid gap-6">
      <AppHeader role={role ?? "tenant_admin"} email={email} title="Teachers & slots" subtitle={slug} slug={slug} />
      <ManageNav slug={slug} active="slots" />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardTitle>Teachers</CardTitle>
          <ul className="mt-4 divide-y divide-outline-variant">
            {teachers?.length ? (
              teachers.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2">
                  <span className="text-on-surface">{t.full_name}</span>
                  <Chip tone="neutral">{t.class_name ?? "no class"}</Chip>
                </li>
              ))
            ) : (
              <li className="py-4 text-sm text-on-surface-variant">No teachers yet.</li>
            )}
          </ul>
          <div className="mt-4 border-t border-outline-variant pt-4">
            <CreateTeacherForm />
          </div>
        </Card>

        <Card>
          <CardTitle>Slots</CardTitle>
          <ul className="mt-4 divide-y divide-outline-variant">
            {slots?.length ? (
              slots.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm text-on-surface">
                      {teacherById.get(s.teacher_id)?.full_name ?? "—"}
                    </div>
                    <div className="text-xs text-on-surface-variant">
                      {formatDateTime(s.starts_at)}
                    </div>
                  </div>
                  {bookedSet.has(s.id) ? (
                    <Chip tone="neutral">Booked</Chip>
                  ) : (
                    <Chip tone="paid">Free</Chip>
                  )}
                </li>
              ))
            ) : (
              <li className="py-4 text-sm text-on-surface-variant">No slots yet.</li>
            )}
          </ul>
          <div className="mt-4 border-t border-outline-variant pt-4">
            <CreateSlotForm teachers={teachers ?? []} />
          </div>
        </Card>
      </div>
    </main>
  );
}
