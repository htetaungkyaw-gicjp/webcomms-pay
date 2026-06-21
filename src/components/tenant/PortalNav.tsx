import Link from "next/link";
import { cn } from "@/lib/utils";

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
        <Link
          key={s.key}
          href={`/${slug}/portal${s.path}`}
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
