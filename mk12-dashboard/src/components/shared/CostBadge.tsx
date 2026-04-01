"use client";

import { DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface CostBadgeProps {
  costUsd: number | undefined | null;
  size?: "sm" | "md";
  className?: string;
}

export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function CostBadge({ costUsd, size = "sm", className }: CostBadgeProps) {
  if (costUsd == null || costUsd === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono tabular-nums",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        className,
      )}
    >
      <DollarSign className={size === "sm" ? "size-2.5" : "size-3"} />
      {formatCost(costUsd)}
    </span>
  );
}
