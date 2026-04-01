"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  Film,
  X,
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
  source: "file";
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function VideoUploadZone({ videos, onChange }: VideoUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
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

      {/* File list */}
      {videos.length > 0 && (
        <div className="rounded-lg border border-border divide-y divide-border">
          {videos.map((video) => (
            <div
              key={video.id}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <HardDrive className="size-4 shrink-0 text-muted-foreground" />
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
