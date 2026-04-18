"use client";

import { cn } from "@/lib/utils";

interface StatusDotProps {
  status: "active" | "pending" | "inactive" | "error";
  size?: "sm" | "md";
  className?: string;
}

const colorMap = {
  active: "bg-tier-high",
  pending: "bg-tier-medium",
  inactive: "bg-text-muted",
  error: "bg-tier-low",
};

const sizeMap = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
};

export default function StatusDot({
  status,
  size = "sm",
  className,
}: StatusDotProps) {
  const shouldPulse = status === "active" || status === "pending";

  return (
    <span className={cn("relative inline-flex", sizeMap[size], className)}>
      {shouldPulse && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
            colorMap[status]
          )}
        />
      )}
      <span
        className={cn(
          "relative inline-flex rounded-full",
          sizeMap[size],
          colorMap[status]
        )}
      />
    </span>
  );
}
