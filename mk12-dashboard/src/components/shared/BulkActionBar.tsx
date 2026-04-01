"use client";

import { CheckCircle2, XCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BulkActionBarProps {
  selectedCount: number;
  onApproveAll: () => void;
  onRejectAll: () => void;
  onClearSelection: () => void;
  isApproving?: boolean;
  isRejecting?: boolean;
  className?: string;
}

export function BulkActionBar({
  selectedCount,
  onApproveAll,
  onRejectAll,
  onClearSelection,
  isApproving = false,
  isRejecting = false,
  className,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 z-50 -translate-x-1/2",
        "flex items-center gap-3 rounded-xl border border-border bg-background-elevated px-4 py-3 shadow-2xl",
        "animate-in slide-in-from-bottom-4 fade-in duration-200",
        className,
      )}
    >
      <span className="text-sm font-medium text-muted-foreground">
        <span className="text-foreground tabular-nums">{selectedCount}</span> selected
      </span>

      <div className="mx-1 h-5 w-px bg-border" />

      <Button
        size="sm"
        variant="ghost"
        onClick={onApproveAll}
        loading={isApproving}
        className="text-green-400 hover:text-green-300 hover:bg-green-400/10"
      >
        <CheckCircle2 className="size-4" />
        Approve All
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onClick={onRejectAll}
        loading={isRejecting}
        className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
      >
        <XCircle className="size-4" />
        Reject All
      </Button>

      <div className="mx-1 h-5 w-px bg-border" />

      <Button
        size="icon-sm"
        variant="ghost"
        onClick={onClearSelection}
        className="text-muted-foreground"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
