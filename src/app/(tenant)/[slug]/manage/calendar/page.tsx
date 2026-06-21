import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { TopNav } from "@/components/dashboard/TopNav";
import { ManageNav } from "@/components/dashboard/ManageNav";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { CreateEventForm } from "@/components/dashboard/CreateEventForm";

export default async function ManageCalendarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: events } = await supabase
    .from("events")
    .select("id, title, event_type, starts_at, ends_at")
    .order("starts_at", { ascending: true });

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 grid gap-6">
      <TopNav title="Calendar" email={user?.email} subtitle={slug} />
      <ManageNav slug={slug} active="calendar" />

      <div className="grid gap-6 md:grid-cols-[1fr_360px]">
        <Card>
          <CardTitle>Events</CardTitle>
          <ul className="mt-4 divide-y divide-outline-variant">
            {events?.length ? (
              events.map((ev) => (
                <li key={ev.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium text-on-surface">{ev.title}</div>
                    <div className="text-xs text-on-surface-variant">
                      {formatDateTime(ev.starts_at)} → {formatDateTime(ev.ends_at)}
                    </div>
                  </div>
                  <Chip tone="neutral">{ev.event_type}</Chip>
                </li>
              ))
            ) : (
              <li className="py-6 text-sm text-on-surface-variant">No events yet.</li>
            )}
          </ul>
        </Card>

        <Card variant="tonal">
          <CardTitle>New event</CardTitle>
          <div className="mt-4">
            <CreateEventForm />
          </div>
        </Card>
      </div>
    </main>
  );
}
