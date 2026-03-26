# Project Creation Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the one-click "New Project" button with a full-page form at `/new-project` where users name their project, attach multiple videos, and configure technical settings before creation.

**Architecture:** New Next.js page route with three form sections (details, videos, settings). Backend API expanded to accept new fields (description, tags, source_urls). Form state managed with React useState hooks, following existing patterns in the codebase.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 4, TanStack Query, Fastify, Zod, Neo4j

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `mk12-backend/src/types/index.ts` | Add `description`, `tags`, `source_urls` to Project type |
| Modify | `mk12-backend/src/routes/projects.ts` | Expand CreateProjectSchema with new fields |
| Modify | `mk12-backend/src/services/project-service.ts` | Handle new fields in createProject/updateProject |
| Modify | `mk12-dashboard/src/lib/types.ts` | Add new fields to dashboard types |
| Modify | `mk12-dashboard/src/lib/api-client.ts` | No changes needed (already sends full body) |
| Modify | `mk12-dashboard/src/hooks/use-project.ts` | No changes needed (already accepts CreateProjectInput) |
| Modify | `mk12-dashboard/src/app/page.tsx` | Change New Project button to Link |
| Create | `mk12-dashboard/src/app/new-project/page.tsx` | Full-page creation form |
| Create | `mk12-dashboard/src/components/project/VideoUploadZone.tsx` | Multi-video upload component |
| Create | `mk12-dashboard/src/components/project/TagInput.tsx` | Tag input with pills |

---

### Task 1: Expand Backend Types

**Files:**
- Modify: `mk12-backend/src/types/index.ts:114-127`

- [ ] **Step 1: Add new fields to Project interface**

In `mk12-backend/src/types/index.ts`, add `description`, `tags`, and `source_urls` to the `Project` interface:

```typescript
export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  description?: string;        // NEW
  tags?: string[];             // NEW
  video_paths: string[];
  source_urls?: string[];      // NEW
  sourceUrl?: string;
  brief?: string;
  fps?: number;
  resolution?: { width: number; height: number };
  created_at: string;
  updated_at: string;
  edit_package?: EditPackageV3;
  pipeline_status?: PipelineStatus;
}
```

- [ ] **Step 2: Verify backend still compiles**

Run: `cd mk12-backend && npx tsc --noEmit`
Expected: No errors (new fields are all optional, no call sites break)

- [ ] **Step 3: Commit**

```bash
git add mk12-backend/src/types/index.ts
git commit -m "feat(backend): add description, tags, source_urls to Project type"
```

---

### Task 2: Expand Backend Validation & Service

**Files:**
- Modify: `mk12-backend/src/routes/projects.ts:21-30`
- Modify: `mk12-backend/src/services/project-service.ts:35-76`

- [ ] **Step 1: Expand CreateProjectSchema in routes**

In `mk12-backend/src/routes/projects.ts`, add the new fields to `CreateProjectSchema`:

```typescript
const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  video_paths: z.array(z.string()).optional(),
  source_urls: z.array(z.string().url()).optional(),
  brief: z.string().optional(),
  fps: z.number().positive().optional(),
  resolution: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});
```

Also expand `UpdateProjectSchema` with the same new fields:

```typescript
const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['created', 'analyzing', 'ready', 'exporting', 'error']).optional(),
  video_paths: z.array(z.string()).optional(),
  source_urls: z.array(z.string().url()).optional(),
  sourceUrl: z.string().url().optional(),
  brief: z.string().optional(),
  fps: z.number().positive().optional(),
  resolution: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});
```

- [ ] **Step 2: Update createProject service to handle new fields**

In `mk12-backend/src/services/project-service.ts`, update the `createProject` function signature and body:

```typescript
export async function createProject(data: {
  name: string;
  description?: string;
  video_paths?: string[];
  source_urls?: string[];
  brief?: string;
  fps?: number;
  resolution?: { width: number; height: number };
  tags?: string[];
}): Promise<Project> {
  const id = uuid();
  const now = new Date().toISOString();

  const project: Project = {
    id,
    name: data.name,
    status: 'created',
    description: data.description,
    tags: data.tags,
    video_paths: data.video_paths ?? [],
    source_urls: data.source_urls,
    brief: data.brief,
    fps: data.fps,
    resolution: data.resolution,
    created_at: now,
    updated_at: now,
  };

  projects.set(id, project);

  // Persist to Neo4j if available
  if (isConnected()) {
    try {
      const q = projectQueries.create(id, data.name, 'created');
      await writeQuery(q.cypher, q.params);

      // Add video nodes for file paths
      for (const vp of project.video_paths) {
        const vq = videoQueries.addToProject(id, vp, undefined, data.fps);
        await writeQuery(vq.cypher, vq.params);
      }

      // Add video nodes for source URLs
      for (const url of project.source_urls ?? []) {
        const vq = videoQueries.addToProject(id, url, undefined, data.fps);
        await writeQuery(vq.cypher, vq.params);
      }
    } catch (err) {
      console.warn('[project-service] Neo4j persist failed:', (err as Error).message);
    }
  }

  return project;
}
```

- [ ] **Step 3: Update updateProject to handle new fields**

In the `updateProject` function, add handlers for the new fields after the existing ones:

```typescript
export async function updateProject(
  id: string,
  data: Partial<Pick<Project, 'name' | 'status' | 'description' | 'tags' | 'video_paths' | 'source_urls' | 'sourceUrl' | 'brief' | 'fps' | 'resolution'>>
): Promise<Project | undefined> {
  const project = projects.get(id);
  if (!project) return undefined;

  if (data.name !== undefined) project.name = data.name;
  if (data.status !== undefined) project.status = data.status;
  if (data.description !== undefined) project.description = data.description;
  if (data.tags !== undefined) project.tags = data.tags;
  if (data.video_paths !== undefined) project.video_paths = data.video_paths;
  if (data.source_urls !== undefined) project.source_urls = data.source_urls;
  if (data.sourceUrl !== undefined) project.sourceUrl = data.sourceUrl;
  if (data.brief !== undefined) project.brief = data.brief;
  if (data.fps !== undefined) project.fps = data.fps;
  if (data.resolution !== undefined) project.resolution = data.resolution;
  project.updated_at = new Date().toISOString();

  // Sync status to Neo4j
  if (isConnected() && data.status) {
    try {
      const q = projectQueries.updateStatus(id, data.status);
      await writeQuery(q.cypher, q.params);
    } catch (err) {
      console.warn('[project-service] Neo4j update failed:', (err as Error).message);
    }
  }

  return project;
}
```

- [ ] **Step 4: Verify backend compiles**

Run: `cd mk12-backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add mk12-backend/src/routes/projects.ts mk12-backend/src/services/project-service.ts
git commit -m "feat(backend): accept description, tags, source_urls in project CRUD"
```

---

### Task 3: Expand Dashboard Types

**Files:**
- Modify: `mk12-dashboard/src/lib/types.ts:24-44`

- [ ] **Step 1: Add new fields to dashboard Project interface**

In `mk12-dashboard/src/lib/types.ts`, add `tags` and `sourceUrls` to `Project` (note: `description` already exists at line 27):

```typescript
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  sourceUrl?: string;
  sourceUrls?: string[];       // NEW
  duration?: number;
  thumbnailUrl?: string;
  segmentCount?: number;
  approvedCount?: number;
  tags?: string[];             // NEW
  owner: User;
  collaborators: User[];
}
```

- [ ] **Step 2: Expand CreateProjectInput**

Update `CreateProjectInput` to accept all form fields:

```typescript
export interface CreateProjectInput {
  name: string;
  description?: string;
  brief?: string;
  video_paths?: string[];
  source_urls?: string[];
  fps?: number;
  resolution?: { width: number; height: number };
  tags?: string[];
}
```

- [ ] **Step 3: Verify dashboard compiles**

Run: `cd mk12-dashboard && npx tsc --noEmit`
Expected: No errors (all new fields optional)

- [ ] **Step 4: Commit**

```bash
git add mk12-dashboard/src/lib/types.ts
git commit -m "feat(dashboard): expand Project and CreateProjectInput types"
```

---

### Task 4: Create TagInput Component

**Files:**
- Create: `mk12-dashboard/src/components/project/TagInput.tsx`

- [ ] **Step 1: Create the TagInput component**

Create `mk12-dashboard/src/components/project/TagInput.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function TagInput({ tags, onChange, placeholder = "Add a tag...", className }: TagInputProps) {
  const [input, setInput] = useState("");

  const addTag = useCallback(
    (value: string) => {
      const trimmed = value.trim().toLowerCase();
      if (!trimmed || tags.includes(trimmed)) return;
      onChange([...tags, trimmed]);
      setInput("");
    },
    [tags, onChange],
  );

  const removeTag = useCallback(
    (index: number) => {
      onChange(tags.filter((_, i) => i !== index));
    },
    [tags, onChange],
  );

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-input px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30",
        className,
      )}
    >
      {tags.map((tag, i) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(i)}
            className="rounded-sm hover:bg-primary/20 transition-colors"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addTag(input);
          }
          if (e.key === "Backspace" && !input && tags.length > 0) {
            removeTag(tags.length - 1);
          }
        }}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="min-w-[120px] flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd mk12-dashboard && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add mk12-dashboard/src/components/project/TagInput.tsx
git commit -m "feat(dashboard): add TagInput component with pill display"
```

---

### Task 5: Create VideoUploadZone Component

**Files:**
- Create: `mk12-dashboard/src/components/project/VideoUploadZone.tsx`

- [ ] **Step 1: Create the VideoUploadZone component**

Create `mk12-dashboard/src/components/project/VideoUploadZone.tsx`:

```tsx
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
  value: string; // file path or URL
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
    let added = 0;
    const errors: string[] = [];

    for (const line of lines) {
      if (isVideoUrl(line.trim())) {
        if (!videos.some((v) => v.value === line.trim())) {
          added++;
        }
      } else {
        errors.push(line.trim());
      }
    }

    // Add all valid ones
    const newEntries: VideoEntry[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!isVideoUrl(trimmed)) continue;
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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd mk12-dashboard && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add mk12-dashboard/src/components/project/VideoUploadZone.tsx
git commit -m "feat(dashboard): add VideoUploadZone component with drag-drop, URL, bulk, folder"
```

---

### Task 6: Create the New Project Page

**Files:**
- Create: `mk12-dashboard/src/app/new-project/page.tsx`

- [ ] **Step 1: Create the new-project page**

Create `mk12-dashboard/src/app/new-project/page.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { VideoUploadZone, type VideoEntry } from "@/components/project/VideoUploadZone";
import { TagInput } from "@/components/project/TagInput";
import { useCreateProject } from "@/hooks/use-project";

const FPS_OPTIONS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];

export default function NewProjectPage() {
  const router = useRouter();
  const createProject = useCreateProject();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brief, setBrief] = useState("");
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [fps, setFps] = useState(24);
  const [resWidth, setResWidth] = useState(1920);
  const [resHeight, setResHeight] = useState(1080);
  const [tags, setTags] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [error, setError] = useState("");

  const isDirty = name || description || brief || videos.length > 0 || tags.length > 0;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;

      setError("");

      const filePaths = videos.filter((v) => v.source === "file").map((v) => v.value);
      const sourceUrls = videos.filter((v) => v.source === "url").map((v) => v.value);

      createProject.mutate(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          brief: brief.trim() || undefined,
          video_paths: filePaths.length > 0 ? filePaths : undefined,
          source_urls: sourceUrls.length > 0 ? sourceUrls : undefined,
          fps,
          resolution: { width: resWidth, height: resHeight },
          tags: tags.length > 0 ? tags : undefined,
        },
        {
          onSuccess: (project) => {
            router.push(`/project/${project.id}/upload`);
          },
          onError: (err) => {
            setError((err as Error).message || "Failed to create project");
          },
        },
      );
    },
    [name, description, brief, videos, fps, resWidth, resHeight, tags, createProject, router],
  );

  const handleCancel = useCallback(() => {
    if (isDirty && !window.confirm("You have unsaved changes. Discard them?")) {
      return;
    }
    router.push("/");
  }, [isDirty, router]);

  return (
    <div className="flex h-screen flex-col">
      <Header />

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="mx-auto max-w-3xl px-6 py-8">
          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="size-4" />
            Back to Projects
          </Link>

          <h1 className="text-2xl font-bold mb-8">Create New Project</h1>

          <form onSubmit={handleSubmit} className="space-y-10">
            {/* ── Section 1: Project Details ── */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Project Details
              </h2>

              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-medium">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Video Project"
                  autoFocus
                  className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="description" className="text-sm font-medium">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this project about?"
                  rows={3}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="brief" className="text-sm font-medium">
                  Brief
                </label>
                <textarea
                  id="brief"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="Provide context to help the AI understand your content..."
                  rows={3}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Provide context to help the AI understand your content
                </p>
              </div>
            </section>

            {/* ── Section 2: Videos ── */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Videos
              </h2>
              <VideoUploadZone videos={videos} onChange={setVideos} />
            </section>

            {/* ── Section 3: Technical Settings ── */}
            <section className="space-y-4">
              <button
                type="button"
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="flex w-full items-center justify-between"
              >
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Technical Settings
                </h2>
                {settingsOpen ? (
                  <ChevronUp className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
              </button>

              {settingsOpen && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    {/* FPS */}
                    <div className="space-y-1.5">
                      <label htmlFor="fps" className="text-sm font-medium">
                        FPS
                      </label>
                      <select
                        id="fps"
                        value={fps}
                        onChange={(e) => setFps(Number(e.target.value))}
                        className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      >
                        {FPS_OPTIONS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Resolution Width */}
                    <div className="space-y-1.5">
                      <label htmlFor="resW" className="text-sm font-medium">
                        Width
                      </label>
                      <input
                        id="resW"
                        type="number"
                        value={resWidth}
                        onChange={(e) => setResWidth(Number(e.target.value))}
                        min={1}
                        className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>

                    {/* Resolution Height */}
                    <div className="space-y-1.5">
                      <label htmlFor="resH" className="text-sm font-medium">
                        Height
                      </label>
                      <input
                        id="resH"
                        type="number"
                        value={resHeight}
                        onChange={(e) => setResHeight(Number(e.target.value))}
                        min={1}
                        className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Tags</label>
                    <TagInput tags={tags} onChange={setTags} />
                  </div>
                </div>
              )}
            </section>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}
          </form>
        </div>
      </main>

      {/* ── Sticky Footer ── */}
      <div className="fixed bottom-0 inset-x-0 border-t border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl flex items-center justify-end gap-3 px-6 py-4">
          <Button type="button" variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!name.trim() || createProject.isPending}
            onClick={handleSubmit}
          >
            {createProject.isPending && <Loader2 className="size-4 animate-spin" />}
            Create Project
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd mk12-dashboard && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add mk12-dashboard/src/app/new-project/page.tsx
git commit -m "feat(dashboard): add /new-project page with full creation form"
```

---

### Task 7: Update Dashboard Home Page

**Files:**
- Modify: `mk12-dashboard/src/app/page.tsx:1-16, 110-111, 134-146`

- [ ] **Step 1: Replace New Project button with Link**

In `mk12-dashboard/src/app/page.tsx`:

1. Add `useRouter` import and remove `useCreateProject`:

Replace the imports:
```tsx
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
```

2. Remove `createProject` from DashboardPage:

```tsx
export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const { data, isLoading } = useProjects();
```

3. Replace the Button with a Link:

```tsx
            <Button asChild>
              <Link href="/new-project">
                <Plus className="size-4" />
                New Project
              </Link>
            </Button>
```

- [ ] **Step 2: Verify it compiles**

Run: `cd mk12-dashboard && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify the dashboard loads in browser**

Run: `cd mk12-dashboard && npm run dev`

Open `http://localhost:3000` — the "New Project" button should now navigate to `/new-project`. The form page should load with all three sections. Test:
- Fill in a name, verify Create button enables
- Drag a file, verify it appears in list
- Add a URL, verify it appears in list
- Add tags, verify pills render
- Click Cancel with data, verify confirmation dialog

- [ ] **Step 4: Commit**

```bash
git add mk12-dashboard/src/app/page.tsx
git commit -m "feat(dashboard): wire New Project button to /new-project page"
```

---

### Task 8: End-to-End Verification

**Files:** None (testing only)

- [ ] **Step 1: Start both servers**

Terminal 1: `cd mk12-backend && npm run dev`
Terminal 2: `cd mk12-dashboard && npm run dev`

- [ ] **Step 2: Test the full creation flow**

1. Open `http://localhost:3000`
2. Click "New Project" — should navigate to `/new-project`
3. Fill in name: "Test Project"
4. Add description and brief
5. Add a video URL (any valid URL)
6. Change FPS to 30
7. Add tags: "test", "demo"
8. Click "Create Project"
9. Should redirect to `/project/[id]/upload`
10. Go back to dashboard — new project should appear in list

- [ ] **Step 3: Test validation**

1. Try to submit without name — button should be disabled
2. Add invalid URL — should show error
3. Add duplicate URL — should show error
4. Fill form, click Cancel — should show confirmation dialog

- [ ] **Step 4: Test backend directly**

```bash
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test",
    "description": "Created via curl",
    "tags": ["api", "test"],
    "source_urls": ["https://example.com/video.mp4"],
    "fps": 30,
    "resolution": {"width": 3840, "height": 2160}
  }'
```

Expected: 201 with project object containing all fields

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: project creation form — end-to-end verified"
```
