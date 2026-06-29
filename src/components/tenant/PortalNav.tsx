import { NavPill } from "@/components/ui/NavPill";

/** Parent portal section nav (M3 tonal pills). */
const SECTIONS = [
  { key: "home", label: "Home", path: "" },
  { key: "calendar", label: "Calendar", path: "/calendar" },
  { key: "notices", label: "Notices", path: "/notices" },
  { key: "book", label: "Book a meeting", path: "/book" },
] as const;

export function PortalNav({
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
          href={`/${slug}/portal${s.path}`}
          active={s.key === active}
        >
          {s.label}
        </NavPill>
      ))}
    </nav>
  );
}
