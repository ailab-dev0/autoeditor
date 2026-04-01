"use client";

import { cn } from "@/lib/utils";
import type { SegmentDecision } from "@/lib/types";

interface SegmentBadgeProps {
  decision: SegmentDecision;
  size?: "sm" | "md";
  className?: string;
}

const DECISION_CONFIG: Record<
  SegmentDecision,
  { label: string; color: string; bg: string; border: string }
> = {
  keep: {
    label: "Keep",
    color: "text-[#27AE60]",
    bg: "bg-[#27AE60]/15",
    border: "border-[#27AE60]/30",
  },
  cut: {
    label: "Cut",
    color: "text-[#E74C3C]",
    bg: "bg-[#E74C3C]/15",
    border: "border-[#E74C3C]/30",
  },
  trim: {
    label: "Trim",
    color: "text-[#F1C40F]",
    bg: "bg-[#F1C40F]/15",
    border: "border-[#F1C40F]/30",
  },
  rearrange: {
    label: "Rearrange",
    color: "text-[#3498DB]",
    bg: "bg-[#3498DB]/15",
    border: "border-[#3498DB]/30",
  },
  speed_up: {
    label: "Speed Up",
    color: "text-[#9B59B6]",
    bg: "bg-[#9B59B6]/15",
    border: "border-[#9B59B6]/30",
  },
  review: {
    label: "Review",
    color: "text-[#E67E22]",
    bg: "bg-[#E67E22]/15",
    border: "border-[#E67E22]/30",
  },
};

export function SegmentBadge({ decision, size = "sm", className }: SegmentBadgeProps) {
  const config = DECISION_CONFIG[decision] ?? DECISION_CONFIG.review;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-semibold uppercase tracking-wider",
        config.color,
        config.bg,
        config.border,
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        className,
      )}
    >
      {config.label ?? decision}
    </span>
  );
}

export { DECISION_CONFIG };
