"use client";

import { cn } from "@/lib/utils";
import { getStatusConfig, isAnimatedStatus } from "./constants";

export function StatusBadge({ status }: { status: string }) {
  const cfg = getStatusConfig(status);
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        cfg.bg,
        cfg.color,
      )}
    >
      <Icon className={cn("size-3", isAnimatedStatus(status) && "animate-spin")} />
      {cfg.label}
    </span>
  );
}
