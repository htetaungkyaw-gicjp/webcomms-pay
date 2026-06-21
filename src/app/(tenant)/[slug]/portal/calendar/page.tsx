import { createClient } from "@/lib/supabase/server";
import { getHeaderContext } from "@/lib/auth-guards";
import { AppHeader } from "@/components/dashboard/AppHeader";
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
  const { email, role } = await getHeaderContext(supabase);

  // RLS: tenant members read their tenant's events.
  const { data: events } = await supabase
    .from("events")
    .select("id, title, event_type, starts_at, ends_at")
    .order("starts_at");

  return (
    <main className="mx-auto w-full max-w-4xl p-4 sm:p-6 grid gap-6">
      <AppHeader role={role ?? "parent"} email={email} title="Calendar" subtitle={slug} slug={slug} />
      <PortalNav slug={slug} active="calendar" />
      <Card>
        <CalendarView events={events ?? []} />
      </Card>
    </main>
  );
}
