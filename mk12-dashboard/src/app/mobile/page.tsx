"use client";

/**
 * Mobile Review — project selector page.
 *
 * Simplified mobile-first interface for creative director review/approval.
 * Lists projects with a tap-to-review flow. No heavy video playback
 * (optimized for mobile bandwidth).
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FolderOpen,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  segmentCount?: number;
  approvedCount?: number;
  updatedAt?: string;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
    review: { icon: Clock, color: "text-yellow-400 bg-yellow-400/10", label: "In Review" },
    approved: { icon: CheckCircle2, color: "text-green-400 bg-green-400/10", label: "Approved" },
    ready: { icon: CheckCircle2, color: "text-blue-400 bg-blue-400/10", label: "Ready" },
    completed: { icon: CheckCircle2, color: "text-green-400 bg-green-400/10", label: "Done" },
    analyzing: { icon: Loader2, color: "text-purple-400 bg-purple-400/10", label: "Analyzing" },
    error: { icon: AlertCircle, color: "text-red-400 bg-red-400/10", label: "Error" },
  };

  const c = config[status] ?? config.review!;
  const Icon = c.icon;

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", c.color)}>
      <Icon className={cn("size-3", status === "analyzing" && "animate-spin")} />
      {c.label}
    </span>
  );
}

export default function MobileHomePage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchProjects = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/projects`);
      const data = await res.json();
      const raw = data.projects ?? [];
      setProjects(
        raw.map((p: Record<string, unknown>) => ({
          id: p.id as string,
          name: p.name as string,
          status: (p.status as string) ?? "created",
          segmentCount: (p.segment_count ?? p.segmentCount ?? 0) as number,
          approvedCount: (p.approved_count ?? p.approvedCount ?? 0) as number,
          updatedAt: ((p.updated_at ?? p.updatedAt) as string) ?? "",
        })),
      );
    } catch {
      // Network error — show empty state
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Pull-to-refresh visual indicator (simplified)
  const handleRefresh = () => fetchProjects(true);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground safe-area-inset">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">MK-12 Review</h1>
            <p className="text-xs text-muted-foreground">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-full hover:bg-accent active:bg-accent/70 transition-colors"
          >
            <RefreshCw className={cn("size-5", isRefreshing && "animate-spin")} />
          </button>
        </div>
      </header>

      {/* Project list */}
      <main className="px-4 py-3 space-y-2">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderOpen className="size-12 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No projects found</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Projects will appear here when created
            </p>
          </div>
        ) : (
          projects.map((project) => {
            const progress =
              project.segmentCount && project.segmentCount > 0
                ? Math.round(
                    ((project.approvedCount ?? 0) / project.segmentCount) * 100,
                  )
                : 0;

            return (
              <Link
                key={project.id}
                href={`/mobile/${project.id}`}
                className="block rounded-xl border border-border bg-card p-4 active:bg-accent/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 mr-3">
                    <h2 className="text-sm font-semibold truncate">
                      {project.name}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={project.status} />
                      {project.segmentCount != null && project.segmentCount > 0 && (
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {project.approvedCount ?? 0}/{project.segmentCount} segments
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                </div>

                {/* Progress bar */}
                {project.segmentCount != null && project.segmentCount > 0 && (
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-400 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 text-right tabular-nums">
                      {progress}% reviewed
                    </p>
                  </div>
                )}
              </Link>
            );
          })
        )}
      </main>

      {/* Bottom safe area spacer */}
      <div className="h-8" />
    </div>
  );
}
