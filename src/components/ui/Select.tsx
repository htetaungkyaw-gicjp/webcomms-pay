import * as React from "react";
import { cn } from "@/lib/utils";
import { filledControl } from "@/components/ui/TextField";

/**
 * M3 filled select — matches TextField (filled surface, bottom underline, label
 * above). Pass <option>s as children. Replaces the hand-styled native <select>s
 * that were duplicated across the create-* forms and BookingPicker.
 */
export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, className, children, ...props }, ref) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    return (
      <div className="grid gap-1">
        <label
          htmlFor={selectId}
          className="text-xs font-medium text-on-surface-variant"
        >
          {label}
        </label>
        <select
          ref={ref}
          id={selectId}
          className={cn("h-12", filledControl, error && "border-error", className)}
          aria-invalid={!!error}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  },
);
Select.displayName = "Select";
