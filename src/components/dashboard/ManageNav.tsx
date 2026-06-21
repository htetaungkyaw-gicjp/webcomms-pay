import Link from "next/link";
import { cn } from "@/lib/utils";

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
        <Link
          key={s.key}
          href={`/${slug}/manage${s.path}`}
          className={cn(
            "rounded-full px-4 h-9 grid place-items-center text-sm font-medium transition-colors",
            s.key === active
              ? "bg-primary text-on-primary"
              : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
          )}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
