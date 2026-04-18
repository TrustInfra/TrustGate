"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full px-3 py-2.5 rounded-lg text-sm text-text",
            "bg-bg-surface border border-border",
            "placeholder:text-text-muted",
            "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20",
            "transition-all duration-200",
            error && "border-tier-low focus:border-tier-low focus:ring-tier-low/20",
            className
          )}
          {...props}
        />
        {hint && !error && (
          <p className="text-[11px] text-text-muted">{hint}</p>
        )}
        {error && <p className="text-[11px] text-tier-low">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
