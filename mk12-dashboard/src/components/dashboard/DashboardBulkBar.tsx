"use client";

import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardBulkBar({
  count,
  onDelete,
  onClear,
  isDeleting,
  deleteProgress,
}: {
  count: number;
  onDelete: () => void;
  onClear: () => void;
  isDeleting: boolean;
  deleteProgress: string | null;
}) {
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-2xl">
      <span className="text-sm font-medium">
        {deleteProgress ?? `${count} selected`}
      </span>
      <Button
        variant="destructive"
        size="sm"
        onClick={onDelete}
        disabled={isDeleting}
      >
        {isDeleting ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
        Delete Selected
      </Button>
      <Button variant="outline" size="sm" onClick={onClear} disabled={isDeleting}>
        Clear Selection
      </Button>
    </div>
  );
}
