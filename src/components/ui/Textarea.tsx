import * as React from "react";
import { cn } from "@/lib/utils";
import { filledControl } from "@/components/ui/TextField";

/**
 * M3 filled multi-line field — matches TextField/Select. Replaces the hand-styled
 * native <textarea> in CreateAnnouncementForm.
 */
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, id, rows = 4, className, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id ?? generatedId;
    return (
      <div className="grid gap-1">
        <label
          htmlFor={textareaId}
          className="text-xs font-medium text-on-surface-variant"
        >
          {label}
        </label>
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={cn("py-2", filledControl, error && "border-error", className)}
          aria-invalid={!!error}
          {...props}
        />
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";
