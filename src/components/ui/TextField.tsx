import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared M3 "filled" control style (DESIGN.md §Components): filled surface,
 * bottom underline, focus thickens/colors the underline to primary. Used by
 * TextField, Select, and Textarea so every form control matches exactly.
 */
export const filledControl =
  "rounded-t-[8px] border-0 border-b-2 border-outline bg-surface-container px-3 " +
  "text-on-surface outline-none transition-colors focus:border-primary";

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
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
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
            "h-12",
            filledControl,
            error && "border-error",
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
