import { createClient } from "@/lib/supabase/server";
import { getHeaderContext } from "@/lib/auth-guards";
import { AppHeader } from "@/components/dashboard/AppHeader";
import { ManageNav } from "@/components/dashboard/ManageNav";
import { Card, CardTitle } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { CreateAnnouncementForm } from "@/components/dashboard/CreateAnnouncementForm";

export default async function ManageAnnouncementsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { email, role } = await getHeaderContext(supabase);

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body, is_urgent, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto w-full max-w-5xl p-4 sm:p-6 grid gap-6">
      <AppHeader role={role ?? "tenant_admin"} email={email} title="Announcements" subtitle={slug} slug={slug} />
      <ManageNav slug={slug} active="announcements" />

      <div className="grid gap-6 md:grid-cols-[1fr_360px]">
        <Card>
          <CardTitle>Posted</CardTitle>
          <ul className="mt-4 grid gap-3">
            {announcements?.length ? (
              announcements.map((a) => (
                <li
                  key={a.id}
                  className="rounded-md border border-outline-variant p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Escaped text render — never dangerouslySetInnerHTML. */}
                    <span className="font-medium text-on-surface">{a.title}</span>
                    {a.is_urgent && <Chip tone="urgent">Urgent</Chip>}
                  </div>
                  {a.body && (
                    <p className="mt-1 text-sm text-on-surface-variant whitespace-pre-wrap">
                      {a.body}
                    </p>
                  )}
                </li>
              ))
            ) : (
              <li className="text-sm text-on-surface-variant">Nothing posted yet.</li>
            )}
          </ul>
        </Card>

        <Card variant="tonal">
          <CardTitle>New announcement</CardTitle>
          <div className="mt-4">
            <CreateAnnouncementForm />
          </div>
        </Card>
      </div>
    </main>
  );
}
