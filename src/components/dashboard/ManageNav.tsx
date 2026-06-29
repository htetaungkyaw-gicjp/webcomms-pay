import { NavPill } from "@/components/ui/NavPill";

/**
 * Tenant-admin section nav (M3 tonal segmented look). Overview ships in Phase 2;
 * the rest (invoices, announcements, calendar, slots) are Phase 3 sub-routes.
 */
const SECTIONS = [
  { key: "overview", label: "Overview", path: "" },
  { key: "invoices", label: "Invoices", path: "/invoices" },
  { key: "announcements", label: "Announcements", path: "/announcements" },
  { key: "calendar", label: "Calendar", path: "/calendar" },
  { key: "slots", label: "Slots", path: "/slots" },
  { key: "admins", label: "Admins", path: "/admins" },
] as const;

export function ManageNav({
  slug,
  active,
}: {
  slug: string;
  active: (typeof SECTIONS)[number]["key"];
}) {
  return (
    <nav className="flex flex-wrap gap-2">
      {SECTIONS.map((s) => (
        <NavPill
          key={s.key}
          href={`/${slug}/manage${s.path}`}
          active={s.key === active}
        >
          {s.label}
        </NavPill>
      ))}
    </nav>
  );
}
