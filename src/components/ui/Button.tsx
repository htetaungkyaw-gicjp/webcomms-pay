import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * M3 button (DESIGN.md §Components). Pill-shaped, with a translucent state-layer
 * on hover/active. Variants: filled (primary action), tonal (secondary
 * container), outlined, text.
 */
type Variant = "filled" | "tonal" | "outlined" | "text";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 h-10 text-sm font-medium font-display " +
  "transition-colors disabled:opacity-50 disabled:pointer-events-none select-none";

const variants: Record<Variant, string> = {
  filled: "bg-primary text-on-primary hover:brightness-110 active:brightness-95",
  tonal:
    "bg-secondary-container text-on-secondary-container hover:brightness-105 active:brightness-95",
  outlined:
    "border border-outline text-primary bg-transparent hover:bg-primary/8 active:bg-primary/12",
  text: "text-primary bg-transparent px-4 hover:bg-primary/8 active:bg-primary/12",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "filled", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
