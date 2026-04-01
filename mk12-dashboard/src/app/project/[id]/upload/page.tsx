"use client";

import { use, useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Film,
  Link as LinkIcon,
  Loader2,
  CheckCircle2,
  Play,
  X,
  Globe,
  HardDrive,
  Tag,
  Settings,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { useProject } from "@/hooks/use-project";
import {
  useProjectVideos,
  useUploadVideo,
  useUploadVideoFromUrl,
  useDeleteVideo,
} from "@/hooks/use-upload";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { UploadedVideo } from "@/lib/types";

interface UploadProgress {
  fileName: string;
  percent: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function UploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const { data: project, isLoading } = useProject(projectId);
  const {
    data: videosData,
    isLoading: videosLoading,
    error: videosError,
  } = useProjectVideos(projectId);
  const uploadVideo = useUploadVideo(projectId);
  const uploadFromUrl = useUploadVideoFromUrl(projectId);
  const deleteVideo = useDeleteVideo(projectId);

  const [dragOver, setDragOver] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [uploads, setUploads] = useState<Map<string, UploadProgress>>(
    new Map(),
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [pipelineStarting, setPipelineStarting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastReportedPercent = useRef<Map<string, number>>(new Map());

  // Abort all in-flight uploads on unmount
  useEffect(() => {
    return () => {
      uploadVideo.abortAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setUploadEntry = useCallback(
    (key: string, entry: UploadProgress) => {
      setUploads((prev) => new Map(prev).set(key, entry));
    },
    [],
  );

  const removeUploadEntry = useCallback((key: string) => {
    setUploads((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const handleCancelUpload = useCallback(
    (key: string) => {
      const abortFn = uploadVideo.abortMap.get(key);
      if (abortFn) {
        abortFn();
        uploadVideo.removeAbort(key);
      }
      removeUploadEntry(key);
      lastReportedPercent.current.delete(key);
    },
    [uploadVideo, removeUploadEntry],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      for (const file of fileArray) {
        const key = `${file.name}-${Date.now()}`;

        setUploadEntry(key, {
          fileName: file.name,
          percent: 0,
          status: "uploading",
        });

        uploadVideo.mutate(
          {
            file,
            uploadKey: key,
            onProgress: (percent) => {
              const rounded = Math.round(percent);
              const last = lastReportedPercent.current.get(key);
              if (last === rounded) return;
              lastReportedPercent.current.set(key, rounded);
              setUploadEntry(key, {
                fileName: file.name,
                percent: rounded,
                status: "uploading",
              });
            },
          },
          {
            onSuccess: () => {
              uploadVideo.removeAbort(key);
              lastReportedPercent.current.delete(key);
              setUploadEntry(key, {
                fileName: file.name,
                percent: 100,
                status: "done",
              });
              // Clear completed entry after a short delay
              setTimeout(() => removeUploadEntry(key), 3000);
            },
            onError: (err) => {
              uploadVideo.removeAbort(key);
              lastReportedPercent.current.delete(key);
              setUploadEntry(key, {
                fileName: file.name,
                percent: 0,
                status: "error",
                error: (err as Error).message,
              });
            },
          },
        );
      }
    },
    [uploadVideo, setUploadEntry, removeUploadEntry],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const handleBrowse = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
        e.target.value = "";
      }
    },
    [handleFiles],
  );

  const handleUrlImport = useCallback(() => {
    if (!sourceUrl.trim()) return;

    const url = sourceUrl.trim();
    setStatusType("loading");
    setStatusMessage(`Importing from URL...`);

    uploadFromUrl.mutate(
      { url },
      {
        onSuccess: (result) => {
          setStatusType("success");
          setStatusMessage(
            `Uploaded: ${result.uploaded.filename} (${formatSize(result.uploaded.size)})`,
          );
          setSourceUrl("");
        },
        onError: (err) => {
          setStatusType("error");
          setStatusMessage(
            `Failed to import URL: ${(err as Error).message}`,
          );
        },
      },
    );
  }, [sourceUrl, uploadFromUrl]);

  const handleDelete = useCallback(
    (video: UploadedVideo) => {
      if (!window.confirm(`Delete "${video.filename}"?`)) return;
      deleteVideo.mutate(video.key, {
        onSuccess: () => {
          setStatusType("success");
          setStatusMessage(`Deleted: ${video.filename}`);
        },
        onError: (err) => {
          setStatusType("error");
          setStatusMessage(
            `Failed to delete: ${(err as Error).message}`,
          );
        },
      });
    },
    [deleteVideo],
  );

  const handleStartPipeline = useCallback(async () => {
    setPipelineStarting(true);
    try {
      await apiClient.pipeline.start(projectId);
      router.push(`/project/${projectId}/pipeline`);
    } catch (err) {
      setPipelineStarting(false);
      setStatusType("error");
      setStatusMessage(
        `Failed to start pipeline: ${(err as Error).message}`,
      );
    }
  }, [projectId, router]);

  const videos = videosData?.videos ?? [];
  const storageWarning = videosData?.warning;
  const hasVideos = videos.length > 0;
  const activeUploads = Array.from(uploads.values()).filter(
    (u) => u.status === "uploading",
  );

  if (isLoading) {
    return (
      <PageLayout title="Upload Source" description="Loading project...">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={project?.name ?? "Upload Source"}
      description="Add videos and start the analysis pipeline"
    >
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Project summary */}
        {project && (
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            {project.description && (
              <p className="text-sm text-muted-foreground">
                {project.description}
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {project.fps && (
                <span className="flex items-center gap-1">
                  <Settings className="size-3" />
                  {project.fps} FPS
                </span>
              )}
              {project.resolution && (
                <span className="flex items-center gap-1">
                  <Settings className="size-3" />
                  {project.resolution.width}x{project.resolution.height}
                </span>
              )}
              {project.brief && (
                <span
                  className="flex items-center gap-1 max-w-xs truncate"
                  title={project.brief}
                >
                  Brief: {project.brief}
                </span>
              )}
            </div>

            {project.tags && project.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    <Tag className="size-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Storage warning */}
        {storageWarning && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-700 dark:text-yellow-400">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              {storageWarning}
            </div>
          </div>
        )}

        {/* Uploaded videos list */}
        {videosLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading videos...
            </span>
          </div>
        ) : videosError ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-400">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              Failed to load videos: {(videosError as Error).message}
            </div>
          </div>
        ) : hasVideos ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Videos ({videos.length})</h3>
            <div className="space-y-2">
              {videos.map((video) => (
                <div
                  key={video.key}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
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
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>{video.source === "minio" ? "Cloud" : "Local"}</span>
                      {video.size != null && video.size > 0 && (
                        <span>{formatSize(video.size)}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(video)}
                    disabled={deleteVideo.isPending}
                    className="rounded-sm p-1 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    title="Delete video"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Active upload progress bars */}
        {uploads.size > 0 && (
          <div className="space-y-2">
            {Array.from(uploads.entries()).map(([key, upload]) => (
              <div
                key={key}
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  upload.status === "uploading" && "border-border bg-muted",
                  upload.status === "done" &&
                    "border-green-500/30 bg-green-500/5",
                  upload.status === "error" &&
                    "border-red-500/30 bg-red-500/5",
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {upload.status === "uploading" && (
                    <Loader2 className="size-3.5 animate-spin shrink-0" />
                  )}
                  {upload.status === "done" && (
                    <CheckCircle2 className="size-3.5 text-green-600 dark:text-green-400 shrink-0" />
                  )}
                  {upload.status === "error" && (
                    <AlertTriangle className="size-3.5 text-red-600 dark:text-red-400 shrink-0" />
                  )}
                  <span className="truncate">{upload.fileName}</span>
                  {upload.status === "uploading" && (
                    <>
                      <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                        {upload.percent}%
                      </span>
                      <button
                        onClick={() => handleCancelUpload(key)}
                        className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                        title="Cancel upload"
                      >
                        <X className="size-3" />
                      </button>
                    </>
                  )}
                  {upload.status === "error" && (
                    <button
                      onClick={() => removeUploadEntry(key)}
                      className="ml-auto rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
                {upload.status === "uploading" && (
                  <div className="h-1.5 rounded-full bg-muted-foreground/20 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${upload.percent}%` }}
                    />
                  </div>
                )}
                {upload.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {upload.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />

        {/* Drag & drop zone */}
        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <Upload className="size-10 text-muted-foreground mb-4" />
          <p className="text-sm font-medium">
            {hasVideos ? "Add more videos" : "Drop your video file here"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            MP4, MOV, WebM, or MKV — uploaded to cloud storage
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={handleBrowse}
            disabled={activeUploads.length > 0}
          >
            <Film className="size-4" />
            Browse Files
          </Button>
        </div>

        {/* URL input */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">
              or import from URL
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="url"
                placeholder="https://example.com/video.mp4"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUrlImport();
                }}
                className="h-10 w-full rounded-md border border-border bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <Button
              disabled={!sourceUrl.trim() || uploadFromUrl.isPending}
              onClick={handleUrlImport}
            >
              {uploadFromUrl.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Import"
              )}
            </Button>
          </div>
        </div>

        {/* Status message */}
        {statusMessage && (
          <div
            className={cn(
              "rounded-lg border p-4 text-sm",
              statusType === "success" &&
                "border-green-500/30 bg-green-500/5 text-green-700 dark:text-green-400",
              statusType === "error" &&
                "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400",
              statusType === "loading" &&
                "border-border bg-muted text-muted-foreground",
            )}
          >
            <div className="flex items-center gap-2">
              {statusType === "success" && (
                <CheckCircle2 className="size-4 shrink-0" />
              )}
              {statusType === "loading" && (
                <Loader2 className="size-4 shrink-0 animate-spin" />
              )}
              {statusType === "error" && (
                <AlertTriangle className="size-4 shrink-0" />
              )}
              {statusMessage}
            </div>
          </div>
        )}

        {/* Start Pipeline */}
        <div className="pt-4 border-t border-border">
          <Button
            size="lg"
            className="w-full"
            disabled={!hasVideos || pipelineStarting || activeUploads.length > 0}
            onClick={handleStartPipeline}
          >
            {pipelineStarting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {pipelineStarting ? "Starting Pipeline..." : "Start Pipeline"}
          </Button>
          {!hasVideos && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Add at least one video to start the pipeline
            </p>
          )}
          {activeUploads.length > 0 && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Wait for uploads to finish before starting the pipeline
            </p>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
