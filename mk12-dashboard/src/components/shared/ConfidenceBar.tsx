"use client";

import { cn } from "@/lib/utils";

interface ConfidenceBarProps {
  value: number; // 0-100
  showLabel?: boolean;
  className?: string;
  size?: "sm" | "md";
}

function getConfidenceColor(value: number): string {
  if (value >= 85) return "bg-green-500";
  if (value >= 70) return "bg-yellow-500";
  return "bg-red-500";
}

function getConfidenceGradient(value: number): string {
  if (value >= 85) return "from-green-600 to-green-400";
  if (value >= 70) return "from-yellow-600 to-yellow-400";
  return "from-red-600 to-red-400";
}

export function ConfidenceBar({
  value,
  showLabel = false,
  className,
  size = "sm",
}: ConfidenceBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const height = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-muted",
          height,
        )}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-all duration-300",
            getConfidenceGradient(clamped),
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums font-medium",
            clamped >= 85
              ? "text-green-400"
              : clamped >= 70
                ? "text-yellow-400"
                : "text-red-400",
          )}
        >
          {clamped}%
        </span>
      )}
    </div>
  );
}
