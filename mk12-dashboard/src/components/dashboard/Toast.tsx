"use client";

import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";

export function Toast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-xl animate-in slide-in-from-bottom-2 fade-in duration-200">
      <CheckCircle2 className="size-4 text-green-400 shrink-0" />
      {message}
      <button
        type="button"
        onClick={onDismiss}
        className="ml-2 text-muted-foreground hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
