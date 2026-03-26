"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  Film,
  Link as LinkIcon,
  X,
  ChevronDown,
  ChevronUp,
  Globe,
  HardDrive,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ".mp4,.mov,.webm,.mkv";
const ACCEPTED_MIME = "video/mp4,video/quicktime,video/webm,video/x-matroska";

export interface VideoEntry {
  id: string;
  name: string;
  size?: number;
  source: "file" | "url";
  value: string;
}

interface VideoUploadZoneProps {
  videos: VideoEntry[];
  onChange: (videos: VideoEntry[]) => void;
}

let entryId = 0;
function nextId() {
  return `video-${++entryId}`;
}

function isVideoUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function VideoUploadZone({ videos, onChange }: VideoUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [bulkExpanded, setBulkExpanded] = useState(false);
  const [bulkUrls, setBulkUrls] = useState("");
  const [urlError, setUrlError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const validExts = [".mp4", ".mov", ".webm", ".mkv"];
      const newEntries: VideoEntry[] = [];

      for (const f of fileArray) {
        const ext = f.name.substring(f.name.lastIndexOf(".")).toLowerCase();
        if (!validExts.includes(ext)) continue;

        const path = (f as File & { path?: string }).path || f.name;
        if (videos.some((v) => v.value === path)) continue;

        newEntries.push({
          id: nextId(),
          name: f.name,
          size: f.size,
          source: "file",
          value: path,
        });
      }

      if (newEntries.length > 0) {
        onChange([...videos, ...newEntries]);
      }
    },
    [videos, onChange],
  );

  const addUrl = useCallback(
    (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) return false;
      if (!isVideoUrl(trimmed)) {
        setUrlError("Invalid URL");
        return false;
      }
      if (videos.some((v) => v.value === trimmed)) {
        setUrlError("URL already added");
        return false;
      }

      setUrlError("");
      const name = trimmed.split("/").pop()?.split("?")[0] || trimmed;
      onChange([
        ...videos,
        { id: nextId(), name, source: "url", value: trimmed },
      ]);
      return true;
    },
    [videos, onChange],
  );

  const addBulkUrls = useCallback(() => {
    const lines = bulkUrls.split("\n").filter((l) => l.trim());
    const errors: string[] = [];
    const newEntries: VideoEntry[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!isVideoUrl(trimmed)) {
        errors.push(trimmed);
        continue;
      }
      if (videos.some((v) => v.value === trimmed)) continue;
      if (newEntries.some((v) => v.value === trimmed)) continue;
      const name = trimmed.split("/").pop()?.split("?")[0] || trimmed;
      newEntries.push({ id: nextId(), name, source: "url", value: trimmed });
    }

    if (newEntries.length > 0) {
      onChange([...videos, ...newEntries]);
    }
    if (errors.length > 0) {
      setUrlError(`${errors.length} invalid URL(s) skipped`);
    } else {
      setUrlError("");
    }
    setBulkUrls("");
    setBulkExpanded(false);
  }, [bulkUrls, videos, onChange]);

  const removeVideo = useCallback(
    (id: string) => {
      onChange(videos.filter((v) => v.id !== id));
    },
    [videos, onChange],
  );

  return (
    <div className="space-y-4">
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={`${ACCEPTED_MIME},${ACCEPTED_TYPES}`}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        accept={`${ACCEPTED_MIME},${ACCEPTED_TYPES}`}
        multiple
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Drag-drop zone */}
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="size-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Drop video files here</p>
        <p className="text-xs text-muted-foreground mt-1">
          MP4, MOV, WebM, or MKV
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Film className="size-4" />
            Browse Files
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => folderInputRef.current?.click()}
          >
            <FolderOpen className="size-4" />
            Select Folder
          </Button>
        </div>
      </div>

      {/* URL input */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="url"
              placeholder="https://example.com/video.mp4"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setUrlError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (addUrl(urlInput)) setUrlInput("");
                }
              }}
              className="h-9 w-full rounded-md border border-border bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!urlInput.trim()}
            onClick={() => {
              if (addUrl(urlInput)) setUrlInput("");
            }}
          >
            Add
          </Button>
        </div>

        {urlError && (
          <p className="text-xs text-red-500">{urlError}</p>
        )}

        {/* Bulk URL toggle */}
        <button
          type="button"
          onClick={() => setBulkExpanded(!bulkExpanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {bulkExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          Paste multiple URLs
        </button>

        {bulkExpanded && (
          <div className="space-y-2">
            <textarea
              value={bulkUrls}
              onChange={(e) => setBulkUrls(e.target.value)}
              placeholder="Paste one URL per line..."
              rows={4}
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!bulkUrls.trim()}
              onClick={addBulkUrls}
            >
              Add All URLs
            </Button>
          </div>
        )}
      </div>

      {/* File list */}
      {videos.length > 0 && (
        <div className="rounded-lg border border-border divide-y divide-border">
          {videos.map((video) => (
            <div
              key={video.id}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              {video.source === "file" ? (
                <HardDrive className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <Globe className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="flex-1 truncate" title={video.value}>
                {video.name}
              </span>
              {video.size != null && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatSize(video.size)}
                </span>
              )}
              <button
                type="button"
                onClick={() => removeVideo(video.id)}
                className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {videos.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-2">
          No videos added yet
        </p>
      )}
    </div>
  );
}
