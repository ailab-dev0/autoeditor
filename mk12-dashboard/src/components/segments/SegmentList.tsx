"use client";

import { useRef, useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Segment } from "@/lib/types";
import { SegmentBadge } from "./SegmentBadge";
import { ConfidenceBar } from "@/components/shared/ConfidenceBar";
import { ConceptTag } from "@/components/shared/ConceptTag";

interface SegmentListProps {
  segments: Segment[];
  selectedId: string | null;
  selectedIds: Set<string>;
  onSelect: (segmentId: string, event: React.MouseEvent) => void;
  onActivate: (segmentId: string) => void;
  className?: string;
}

const ROW_HEIGHT = 52;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function ApprovalIcon({ status }: { status: Segment["approvalStatus"] }) {
  switch (status) {
    case "approved":
      return <CheckCircle2 className="size-4 text-green-400" />;
    case "rejected":
      return <Circle className="size-4 text-red-400" />;
    case "overridden":
      return <CheckCircle2 className="size-4 text-yellow-400" />;
    default:
      return <Circle className="size-4 text-muted-foreground-dim" />;
  }
}

export function SegmentList({
  segments,
  selectedId,
  selectedIds,
  onSelect,
  onActivate,
  className,
}: SegmentListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: segments.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className={cn("overflow-auto", className)}>
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualItems.map((virtualItem) => {
          const segment = segments[virtualItem.index];
          if (!segment) return null;

          const isActive = segment.id === selectedId;
          const isSelected = selectedIds.has(segment.id);

          return (
            <div
              key={segment.id}
              className={cn(
                "absolute left-0 top-0 flex w-full cursor-pointer items-center gap-3 border-b border-border-dim px-3 transition-colors",
                isActive
                  ? "bg-primary/10 border-l-2 border-l-primary"
                  : isSelected
                    ? "bg-accent/60"
                    : "hover:bg-accent/40",
              )}
              style={{
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
              onClick={(e) => onSelect(segment.id, e)}
              onDoubleClick={() => onActivate(segment.id)}
              role="row"
              tabIndex={0}
              aria-selected={isActive}
            >
              {/* Timestamp */}
              <span className="shrink-0 w-[72px] text-xs tabular-nums text-muted-foreground font-mono">
                {formatTime(segment.startTime)}
              </span>

              {/* Decision badge */}
              <span className="shrink-0 w-[72px]">
                <SegmentBadge decision={segment.decision} />
              </span>

              {/* Confidence */}
              <span className="shrink-0 w-[80px]">
                <ConfidenceBar value={segment.confidence} showLabel size="sm" />
              </span>

              {/* Concept tag */}
              <span className="shrink-0 w-[100px] truncate">
                {segment.conceptLabel ? (
                  <ConceptTag
                    label={segment.conceptLabel}
                    communityColor={segment.communityColor}
                    size="sm"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground-dim">--</span>
                )}
              </span>

              {/* Text preview */}
              <span className="min-w-0 flex-1 truncate text-sm text-foreground/80">
                {segment.transcript}
              </span>

              {/* Approval check */}
              <span className="shrink-0">
                <ApprovalIcon status={segment.approvalStatus} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { ROW_HEIGHT, formatTime };
