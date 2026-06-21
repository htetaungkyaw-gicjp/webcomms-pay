import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { TopNav } from "@/components/dashboard/TopNav";
import { PortalNav } from "@/components/tenant/PortalNav";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { AckButton } from "@/components/tenant/AckButton";

/**
 * Notices tab. Announcements are rendered as ESCAPED TEXT (React escapes by
 * default; we NEVER use dangerouslySetInnerHTML) and were sanitized to plain
 * text on the way in — defense in depth against stored XSS. Each notice has a
 * "Noted" ack the parent records for themselves.
 */
export default async function PortalNoticesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body, is_urgent, created_at")
    .order("created_at", { ascending: false });

  // The parent's own acks (RLS: ack_select within tenant).
  const { data: acks } = await supabase
    .from("announcement_acknowledgements")
    .select("announcement_id")
    .eq("parent_id", user?.id ?? "");
  const ackedSet = new Set((acks ?? []).map((a) => a.announcement_id));

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6 grid gap-6">
      <TopNav title="Notices" email={user?.email} subtitle={slug} />
      <PortalNav slug={slug} active="notices" />

      <div className="grid gap-3">
        {announcements?.length ? (
          announcements.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-medium text-on-surface">{a.title}</h3>
                    {a.is_urgent && <Chip tone="urgent">Urgent</Chip>}
                  </div>
                  {a.body && (
                    <p className="mt-1 text-sm text-on-surface-variant whitespace-pre-wrap">
                      {a.body}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-on-surface-variant">
                    {formatDateTime(a.created_at)}
                  </p>
                </div>
                <AckButton announcementId={a.id} acknowledged={ackedSet.has(a.id)} />
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-sm text-on-surface-variant">No notices yet.</p>
          </Card>
        )}
      </div>
    </main>
  );
}
