import { cn } from "@/lib/utils";

/**
 * M3 tonal stat tile (DESIGN.md §Components). A large tabular number over a
 * label, on a tonal container. `tone` mixes primary/secondary/tertiary/neutral.
 */
type Tone = "primary" | "secondary" | "tertiary" | "neutral";

const tones: Record<Tone, string> = {
  primary: "bg-primary-container text-on-primary-container",
  secondary: "bg-secondary-container text-on-secondary-container",
  tertiary: "bg-tertiary-container text-on-tertiary-container",
  neutral: "bg-surface-container-high text-on-surface",
};

export function StatTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: Tone;
}) {
  return (
    <div className={cn("rounded-md p-5", tones[tone])}>
      <div className="tabular font-display text-3xl font-medium">{value}</div>
      <div className="mt-1 text-sm opacity-80">{label}</div>
    </div>
  );
}
