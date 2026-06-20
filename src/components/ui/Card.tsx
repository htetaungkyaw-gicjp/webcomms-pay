import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * M3 card (DESIGN.md §Components). `outlined` (default) or `tonal` (elevated via
 * surface-container tone + subtle shadow, not a heavy drop shadow). 24px radius.
 */
export function Card({
  variant = "outlined",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: "outlined" | "tonal" }) {
  return (
    <div
      className={cn(
        "rounded-[24px] p-6",
        variant === "outlined"
          ? "border border-outline-variant bg-surface"
          : "bg-surface-container shadow-[0_1px_3px_rgba(0,0,0,0.08)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("font-display text-lg font-medium text-on-surface", className)}
      {...props}
    />
  );
}
