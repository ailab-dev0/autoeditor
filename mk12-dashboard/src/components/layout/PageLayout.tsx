"use client";

import { cn } from "@/lib/utils";

interface PageLayoutProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  fullHeight?: boolean;
}

export function PageLayout({
  title,
  description,
  actions,
  children,
  className,
  fullHeight = false,
}: PageLayoutProps) {
  return (
    <div className={cn("flex flex-col", fullHeight ? "h-full" : "min-h-full", className)}>
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Page content */}
      <div className={cn("flex-1", fullHeight ? "overflow-hidden" : "p-6")}>
        {children}
      </div>
    </div>
  );
}
