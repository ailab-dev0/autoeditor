"use client";

import Link from "next/link";
import { Film, Trash2 } from "lucide-react";
import type { Project } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { formatRelativeTime, videoCount } from "./constants";

export function ProjectCard({
  project,
  onDelete,
}: {
  project: Project;
  onDelete: (p: Project) => void;
}) {
  const approvalRate =
    project.segmentCount && project.approvedCount
      ? Math.round((project.approvedCount / project.segmentCount) * 100)
      : null;
  const vCount = videoCount(project);

  return (
    <div className="group relative rounded-xl border border-border bg-card transition-all hover:border-border/60 hover:bg-accent/20">
      <Link
        href={`/project/${project.id}/review`}
        className="block p-4"
      >
        {/* Thumbnail */}
        <div className="relative mb-3 aspect-video overflow-hidden rounded-lg bg-muted">
          {project.thumbnailUrl ? (
            <img
              src={project.thumbnailUrl}
              alt={project.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Film className="size-8 text-muted-foreground/40" />
            </div>
          )}
          <span className="absolute bottom-2 right-2">
            <StatusBadge status={project.status} />
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
            {vCount > 0
              ? `${vCount} video${vCount !== 1 ? "s" : ""}`
              : project.segmentCount != null && project.segmentCount > 0
                ? `${project.segmentCount} segments`
                : "No videos yet"}
          </span>
          {approvalRate != null && (
            <span className="tabular-nums">{approvalRate}% approved</span>
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between">
          {project.duration != null && (
            <span className="text-[10px] text-muted-foreground/60 font-mono">
              {Math.floor(project.duration / 60)}m {Math.floor(project.duration % 60)}s
            </span>
          )}
          {project.createdAt && (
            <span className="text-[10px] text-muted-foreground/60 ml-auto">
              {formatRelativeTime(project.createdAt)}
            </span>
          )}
        </div>
      </Link>

      {/* Delete button */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete(project);
        }}
        className="absolute top-2 right-2 rounded-md p-1.5 text-muted-foreground/60 opacity-0 transition-all hover:bg-destructive/15 hover:text-red-400 group-hover:opacity-100"
        title="Delete project"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
