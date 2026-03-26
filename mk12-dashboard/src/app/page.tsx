"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { useProjects } from "@/hooks/use-project";
import { cn } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/lib/types";

const STATUS_CONFIG: Record<
  ProjectStatus,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  uploading: { icon: Loader2, color: "text-blue-400", label: "Uploading" },
  analyzing: { icon: Loader2, color: "text-primary", label: "Analyzing" },
  review: { icon: Clock, color: "text-yellow-400", label: "In Review" },
  approved: { icon: CheckCircle2, color: "text-green-400", label: "Approved" },
  exporting: { icon: Loader2, color: "text-purple-400", label: "Exporting" },
  completed: { icon: CheckCircle2, color: "text-green-400", label: "Completed" },
  error: { icon: AlertCircle, color: "text-red-400", label: "Error" },
};

function ProjectCard({ project }: { project: Project }) {
  const statusConfig = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.review;
  const StatusIcon = statusConfig.icon;
  const approvalRate =
    project.segmentCount && project.approvedCount
      ? Math.round((project.approvedCount / project.segmentCount) * 100)
      : null;

  return (
    <Link
      href={`/project/${project.id}/review`}
      className="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-border/60 hover:bg-accent/20"
    >
      {/* Thumbnail placeholder */}
      <div className="relative mb-3 aspect-video overflow-hidden rounded-lg bg-muted">
        {project.thumbnailUrl ? (
          <img
            src={project.thumbnailUrl}
            alt={project.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Film className="size-8 text-muted-foreground-dim" />
          </div>
        )}
        {/* Status badge overlay */}
        <span
          className={cn(
            "absolute bottom-2 right-2 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider",
            "bg-background/80 backdrop-blur-sm",
            statusConfig.color,
          )}
        >
          <StatusIcon
            className={cn(
              "size-3",
              (project.status === "analyzing" || project.status === "uploading" || project.status === "exporting") &&
                "animate-spin",
            )}
          />
          {statusConfig.label}
        </span>
      </div>

      <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
        {project.name}
      </h3>

      {project.description && (
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {project.description}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {project.segmentCount != null ? `${project.segmentCount} segments` : "No segments"}
        </span>
        {approvalRate != null && (
          <span className="tabular-nums">{approvalRate}% approved</span>
        )}
      </div>

      {project.duration != null && (
        <span className="mt-1 block text-[10px] text-muted-foreground-dim font-mono">
          {Math.floor(project.duration / 60)}m {Math.floor(project.duration % 60)}s
        </span>
      )}
    </Link>
  );
}

export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const { data, isLoading } = useProjects();

  const projects = data?.data ?? [];

  const filtered = projects.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex h-screen flex-col">
      <Header />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-8">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">Projects</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your pedagogical video editing projects
              </p>
            </div>
            <Button asChild>
              <Link href="/new-project">
                <Plus className="size-4" />
                New Project
              </Link>
            </Button>
          </div>

          {/* Search + filter bar */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div className="flex gap-1">
              {(["all", "analyzing", "review", "completed"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    statusFilter === s
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}
                >
                  {s === "all" ? "All" : STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Project grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Film className="size-12 text-muted-foreground-dim mb-4" />
              <p className="text-sm text-muted-foreground">
                {search || statusFilter !== "all"
                  ? "No projects match your filters"
                  : "No projects yet. Create your first one."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
