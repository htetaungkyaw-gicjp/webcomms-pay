import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * M3 status chip (DESIGN.md §Components). Tonal container per status. Status is
 * never conveyed by color alone — the label text is always present (quality
 * floor). `tone` picks the container/on-container pair.
 */
type Tone = "due" | "paid" | "invited" | "urgent" | "neutral" | "void";

const tones: Record<Tone, string> = {
  due: "bg-error-container text-on-error-container",
  void: "bg-error-container text-on-error-container",
  paid: "bg-success-container text-on-success-container",
  invited: "bg-primary-container text-on-primary-container",
  urgent: "bg-error-container text-on-error-container",
  neutral: "bg-surface-variant text-on-surface-variant",
};

export function Chip({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Map an invoice status to a chip with a human label. */
export function InvoiceStatusChip({ status }: { status: string }) {
  if (status === "paid") return <Chip tone="paid">Paid</Chip>;
  if (status === "void") return <Chip tone="void">Void</Chip>;
  return <Chip tone="due">Due</Chip>;
}
