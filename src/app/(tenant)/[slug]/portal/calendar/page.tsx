import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/dashboard/TopNav";
import { PortalNav } from "@/components/tenant/PortalNav";
import { Card } from "@/components/ui/Card";
import { CalendarView } from "@/components/tenant/CalendarView";

export default async function PortalCalendarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS: tenant members read their tenant's events.
  const { data: events } = await supabase
    .from("events")
    .select("id, title, event_type, starts_at, ends_at")
    .order("starts_at");

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-6 grid gap-6">
      <TopNav title="Calendar" email={user?.email} subtitle={slug} />
      <PortalNav slug={slug} active="calendar" />
      <Card>
        <CalendarView events={events ?? []} />
      </Card>
    </main>
  );
}
