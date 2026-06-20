import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * M3 filled text field (DESIGN.md §Components): filled surface, bottom underline,
 * label above. Focus thickens/colors the underline to primary (via focus ring on
 * the wrapper). Kept simple — a real floating label is optional polish.
 */
export interface TextFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, id, className, ...props }, ref) => {
    const inputId = id ?? React.useId();
    return (
      <div className="grid gap-1">
        <label
          htmlFor={inputId}
          className="text-xs font-medium text-on-surface-variant"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-12 rounded-t-[8px] border-0 border-b-2 bg-surface-container px-3 text-on-surface",
            "outline-none focus:border-primary",
            error ? "border-error" : "border-outline",
            className,
          )}
          aria-invalid={!!error}
          {...props}
        />
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  },
);
TextField.displayName = "TextField";
