"use client";

import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "accent" | "success" | "warning" | "danger";
  size?: "sm" | "md";
  className?: string;
}

const variantClasses = {
  default: "bg-bg-surface text-text-secondary border-border",
  accent: "bg-accent-muted text-accent border-accent/20",
  success: "bg-tier-high-muted text-tier-high border-tier-high/20",
  warning: "bg-tier-medium-muted text-tier-medium border-tier-medium/20",
  danger: "bg-tier-low-muted text-tier-low border-tier-low/20",
};

const sizeClasses = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-0.5 text-xs",
};

export default function Badge({
  children,
  variant = "default",
  size = "md",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-medium",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
}
