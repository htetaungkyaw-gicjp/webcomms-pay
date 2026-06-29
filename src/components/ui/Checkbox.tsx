import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * M3-styled checkbox with an inline label. Uses native `accent-color` (primary)
 * so it themes with the palette and inherits the global :focus-visible ring.
 * Replaces the bare <input type="checkbox"> in the announcement form.
 */
export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, id, className, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    return (
      <label
        htmlFor={inputId}
        className="flex items-center gap-2 text-sm text-on-surface select-none"
      >
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className={cn("size-4 accent-primary", className)}
          {...props}
        />
        {label}
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";
