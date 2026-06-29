import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * M3 tonal nav pill (the segmented-nav look). Encapsulates the
 * `rounded-full px-4 h-9 …` + active/inactive token classes that were duplicated
 * across ManageNav, PortalNav, AppHeader, and the admin pages.
 *
 * `active` paints the filled primary state; otherwise it's a quiet tonal pill.
 * `tone="ghost"` is a transparent variant for header links that shouldn't carry
 * a resting container (matches AppHeader's previous look).
 */
export function NavPill({
  href,
  active = false,
  tone = "tonal",
  className,
  children,
}: {
  href: string;
  active?: boolean;
  tone?: "tonal" | "ghost";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-4 h-9 grid place-items-center text-sm font-medium transition-colors",
        active
          ? "bg-primary text-on-primary"
          : tone === "ghost"
            ? "text-on-surface-variant hover:bg-surface-container-high"
            : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
        className,
      )}
    >
      {children}
    </Link>
  );
}
