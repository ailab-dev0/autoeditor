"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import {
  Upload,
  Eye,
  Download,
  GitBranch,
  Film,
  Clock,
  Settings,
  Tag,
  Pencil,
  Check,
  X,
  Loader2,
  Globe,
  HardDrive,
  FileText,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { useProject, useUpdateProject } from "@/hooks/use-project";
import { useProjectVideos } from "@/hooks/use-upload";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { cn } from "@/lib/utils";
import type { Project, PipelineStage } from "@/lib/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}


function pipelineStageStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="size-3.5 text-green-400" />;
    case "running":
      return <Loader2 className="size-3.5 text-primary animate-spin" />;
    case "error":
      return <AlertTriangle className="size-3.5 text-red-400" />;
    default:
      return <div className="size-3.5 rounded-full border border-border" />;
  }
}

// ─── Inline Edit Field ──────────────────────────────────────────────────────

function InlineEdit({
  value,
  onSave,
  as: Tag = "span",
  className,
  inputClassName,
  multiline = false,
  placeholder,
}: {
  value: string;
  onSave: (val: string) => void;
  as?: "span" | "h2" | "p";
  className?: string;
  inputClassName?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    }
    setEditing(false);
  }, [draft, value, onSave]);

  const cancel = useCallback(() => {
    setDraft(value);
    setEditing(false);
  }, [value]);

  if (editing) {
    const shared =
      "w-full rounded border border-primary bg-input px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30";
    return (
      <div className="flex items-start gap-1.5">
        {multiline ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
              if (e.key === "Enter" && e.metaKey) commit();
            }}
            rows={3}
            className={cn(shared, "resize-none", inputClassName)}
          />
        ) : (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") cancel();
            }}
            className={cn(shared, inputClassName)}
          />
        )}
        <button
          onClick={commit}
          className="rounded p-1 text-green-500 hover:bg-green-500/10"
        >
          <Check className="size-3.5" />
        </button>
        <button
          onClick={cancel}
          className="rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-1.5">
      <Tag className={className}>
        {value || (
          <span className="italic text-muted-foreground">{placeholder ?? "—"}</span>
        )}
      </Tag>
      <button
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="rounded p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-accent transition-opacity"
      >
        <Pencil className="size-3" />
      </button>
    </div>
  );
}

// ─── Tags Editor ────────────────────────────────────────────────────────────

function TagsEditor({
  tags,
  onSave,
}: {
  tags: string[];
  onSave: (tags: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tags.join(", "));

  const commit = useCallback(() => {
    const parsed = draft
      .split(",")
      .map((t) => t.trim())
      .filter((t, i, arr) => t && arr.indexOf(t) === i);
    onSave(parsed);
    setEditing(false);
  }, [draft, onSave]);

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(tags.join(", "));
              setEditing(false);
            }
          }}
          placeholder="tag1, tag2, tag3"
          className="flex-1 rounded border border-primary bg-input px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <button
          onClick={commit}
          className="rounded p-1 text-green-500 hover:bg-green-500/10"
        >
          <Check className="size-3" />
        </button>
        <button
          onClick={() => {
            setDraft(tags.join(", "));
            setEditing(false);
          }}
          className="rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <X className="size-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-1.5 flex-wrap">
      {tags.length > 0 ? (
        tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          >
            <Tag className="size-3" />
            {tag}
          </span>
        ))
      ) : (
        <span className="text-xs italic text-muted-foreground">No tags</span>
      )}
      <button
        onClick={() => {
          setDraft(tags.join(", "));
          setEditing(true);
        }}
        className="rounded p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-accent transition-opacity"
      >
        <Pencil className="size-3" />
      </button>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const { data: project, isLoading } = useProject(projectId);
  const { data: videosData, isLoading: videosLoading } = useProjectVideos(projectId);
  const updateProject = useUpdateProject();

  const videos = videosData?.videos ?? [];
  const pipelineStages: PipelineStage[] = project?.pipelineStatus?.stages ?? [];
  const overallProgress: number = project?.pipelineStatus?.overallProgress ?? 0;

  const handleUpdate = useCallback(
    (data: Partial<Pick<Project, "name" | "description" | "brief" | "tags">>) => {
      updateProject.mutate({ id: projectId, data });
    },
    [projectId, updateProject],
  );

  if (isLoading) {
    return (
      <PageLayout title="Project Overview" description="Loading...">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  if (!project) {
    return (
      <PageLayout title="Project Overview" description="Project not found">
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <AlertTriangle className="size-10 mb-3" />
          <p className="text-sm">Could not load project.</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Overview"
      description="Project summary and quick actions"
      actions={<StatusBadge status={project.status} />}
    >
      <div className="mx-auto max-w-3xl space-y-6">
        {/* ── Project Summary ─────────────────────────────────────── */}
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <InlineEdit
            value={project.name}
            onSave={(name) => handleUpdate({ name })}
            as="h2"
            className="text-base font-semibold"
          />

          <InlineEdit
            value={project.description ?? ""}
            onSave={(description) => handleUpdate({ description })}
            as="p"
            className="text-sm text-muted-foreground"
            multiline
            placeholder="Add a description..."
          />

          {(project.brief || true) && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Brief
              </span>
              <InlineEdit
                value={project.brief ?? ""}
                onSave={(brief) => handleUpdate({ brief })}
                as="p"
                className="text-sm text-muted-foreground"
                multiline
                placeholder="Add a brief..."
              />
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              Created {formatDate(project.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              Updated {formatDate(project.updatedAt)}
            </span>
          </div>
        </section>

        {/* ── Quick Actions ───────────────────────────────────────── */}
        <section className="grid grid-cols-3 gap-3">
          <Link href={`/project/${projectId}/upload`}>
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer">
              <Upload className="size-5 text-primary" />
              <span className="text-sm font-medium">Upload</span>
            </div>
          </Link>
          <Link href={`/project/${projectId}/review`}>
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer">
              <Eye className="size-5 text-primary" />
              <span className="text-sm font-medium">Review</span>
            </div>
          </Link>
          <Link href={`/project/${projectId}/export`}>
            <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer">
              <Download className="size-5 text-primary" />
              <span className="text-sm font-medium">Export</span>
            </div>
          </Link>
        </section>

        {/* ── Settings & Tags ─────────────────────────────────────── */}
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Settings className="size-4" />
            Settings
          </h3>

          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">FPS</span>
              <p className="font-mono">{project.fps ?? "—"}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Resolution</span>
              <p className="font-mono">
                {project.resolution
                  ? `${project.resolution.width}x${project.resolution.height}`
                  : "—"}
              </p>
            </div>
            {project.duration != null && (
              <div>
                <span className="text-xs text-muted-foreground">Duration</span>
                <p className="font-mono">
                  {Math.floor(project.duration / 60)}m {Math.round(project.duration % 60)}s
                </p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground block mb-1.5">Tags</span>
            <TagsEditor
              tags={project.tags ?? []}
              onSave={(tags) => handleUpdate({ tags })}
            />
          </div>
        </section>

        {/* ── Pipeline Status ─────────────────────────────────────── */}
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <GitBranch className="size-4" />
              Pipeline
            </h3>
            <Link href={`/project/${projectId}/pipeline`}>
              <Button variant="ghost" size="sm">
                View Pipeline
              </Button>
            </Link>
          </div>

          {pipelineStages.length > 0 ? (
            <>
              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Overall progress</span>
                  <span className="tabular-nums">{overallProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
              </div>

              {/* Stage list */}
              <div className="space-y-2">
                {pipelineStages.map((stage) => (
                  <div
                    key={stage.name}
                    className="flex items-center gap-3 text-sm"
                  >
                    {pipelineStageStatusIcon(stage.status)}
                    <span
                      className={cn(
                        "flex-1",
                        stage.status === "completed" && "text-muted-foreground",
                        stage.status === "running" && "text-foreground font-medium",
                        stage.status === "error" && "text-red-400",
                      )}
                    >
                      {stage.label}
                    </span>
                    {stage.status === "running" && stage.progress > 0 && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {stage.progress}%
                      </span>
                    )}
                    {stage.status === "completed" && stage.duration != null && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {stage.duration < 60
                          ? `${Math.round(stage.duration)}s`
                          : `${Math.floor(stage.duration / 60)}m ${Math.round(stage.duration % 60)}s`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Pipeline has not been started yet.{" "}
              <Link
                href={`/project/${projectId}/upload`}
                className="text-primary hover:underline"
              >
                Upload videos
              </Link>{" "}
              to begin.
            </p>
          )}

          {/* Segment counts */}
          {(project.segmentCount ?? 0) > 0 && (
            <div className="flex gap-6 pt-3 border-t border-border text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Segments</span>
                <p className="text-lg font-semibold tabular-nums">
                  {project.segmentCount}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Approved</span>
                <p className="text-lg font-semibold tabular-nums text-green-400">
                  {project.approvedCount}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Pending</span>
                <p className="text-lg font-semibold tabular-nums">
                  {(project.segmentCount ?? 0) - (project.approvedCount ?? 0)}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ── Videos ──────────────────────────────────────────────── */}
        <section className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Film className="size-4" />
              Videos
              {!videosLoading && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({videos.length})
                </span>
              )}
            </h3>
            <Link href={`/project/${projectId}/upload`}>
              <Button variant="ghost" size="sm">
                <Upload className="size-3.5" />
                Upload
              </Button>
            </Link>
          </div>

          {videosLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : videos.length > 0 ? (
            <div className="space-y-2">
              {videos.map((video) => (
                <div
                  key={video.key}
                  className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5"
                >
                  {video.source === "minio" ? (
                    <Globe className="size-4 text-muted-foreground shrink-0" />
                  ) : (
                    <HardDrive className="size-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    {video.url ? (
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono truncate block hover:underline"
                      >
                        {video.filename}
                      </a>
                    ) : (
                      <span className="text-sm font-mono truncate block">
                        {video.filename}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground shrink-0">
                    <span>{video.source === "minio" ? "Cloud" : "Local"}</span>
                    {video.size != null && video.size > 0 && (
                      <span>{formatSize(video.size)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Film className="size-8 mb-2 opacity-40" />
              <p className="text-sm">No videos uploaded yet.</p>
              <Link href={`/project/${projectId}/upload`}>
                <Button variant="outline" size="sm" className="mt-3">
                  <Upload className="size-3.5" />
                  Upload Videos
                </Button>
              </Link>
            </div>
          )}
        </section>

        {/* ── Source URLs ─────────────────────────────────────────── */}
        {project.sourceUrls && project.sourceUrls.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Globe className="size-4" />
              Source URLs
            </h3>
            <div className="space-y-1.5">
              {project.sourceUrls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-primary hover:underline truncate"
                >
                  {url}
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </PageLayout>
  );
}
