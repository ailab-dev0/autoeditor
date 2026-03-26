# Project Creation Form — Design Spec

## Summary

Replace the current one-click "New Project" button with a dedicated full-page creation form at `/new-project`. Users fill in project details, upload multiple videos (file picker, URL import, bulk paste, folder select), configure technical settings, and create the project. On success, redirect to `/project/[id]/upload` so they can add more videos if needed.

## Motivation

Currently, projects are created with an auto-generated name and no metadata. Users want to name projects at creation time, attach videos upfront, and provide context for AI analysis — all in one step.

---

## Route & Layout

- **Path**: `/new-project`
- **Layout**: Standard dashboard `Header`, no sidebar. Single scrollable page.
- **Max width**: ~768px, centered horizontally.
- **Back navigation**: Cancel button returns to dashboard (`/`).

---

## Form Sections

### 1. Project Details

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name | Text input | Yes | Autofocused. Only required field in the entire form. |
| Description | Textarea | No | General project description. |
| Brief | Textarea | No | Helper text: "Provide context to help the AI understand your content" |

### 2. Videos

**Upload methods:**

1. **Drag-drop zone** — Large drop area at top of section. Accepts MP4, MOV, WebM, MKV.
2. **File picker** — "Browse files" button within the drop zone.
3. **Folder select** — "Select folder" option to import all videos from a directory.
4. **Single URL** — Text input with "Add" button.
5. **Bulk URL paste** — Expandable textarea below the single URL input. Parses one URL per line.

**File list:**
- Shows all added videos: name, file size (for local files), source type icon (file vs URL), remove button.
- Empty state: "No videos added yet"
- Virtualized list if >20 videos, otherwise simple list.

**Validation:**
- File type validation on drop (MP4, MOV, WebM, MKV only).
- URL validation on paste (must look like a video URL or direct link).
- Duplicate detection: toast warning, skip the duplicate, keep the rest.
- Failed URL validation: inline error under the URL input, doesn't block other URLs in bulk paste.

**Videos are optional.** Users can create a project with just a name and add videos later on the upload page.

### 3. Technical Settings

Collapsible section, open by default.

| Field | Type | Default | Options |
|-------|------|---------|---------|
| FPS | Select dropdown | 24 | 23.976, 24, 25, 29.97, 30, 50, 59.94, 60 |
| Resolution Width | Number input | 1920 | — |
| Resolution Height | Number input | 1080 | — |
| Tags | Pill/tag input | Empty | Free-text tags with add/remove |

### 4. Footer

Sticky bottom bar:
- **Cancel** — Returns to dashboard. If form has data, show confirmation dialog.
- **Create Project** — Primary button. Disabled until name is filled. Shows loading state during submission.

---

## Data & API Changes

### Backend: `POST /api/projects`

Expand `CreateProjectInput`:

```typescript
interface CreateProjectInput {
  name: string            // required
  description?: string    // new
  brief?: string          // existing
  video_paths?: string[]  // existing
  source_urls?: string[]  // new — URL imports
  fps?: number            // existing, default 24
  resolution?: {          // existing, default 1920x1080
    width: number
    height: number
  }
  tags?: string[]         // new
}
```

### Backend: Project type

Add new fields to the `Project` interface in `mk12-backend/src/types/index.ts`:

```typescript
// Add to existing Project interface:
description?: string
tags?: string[]
source_urls?: string[]
```

### Neo4j

No schema changes. `Project` node gains `description`, `tags` (string array), and `source_urls` (string array) as properties. Videos from URLs create `Video` nodes via `HAS_VIDEO` relationships, same as file paths.

### Dashboard: types.ts

Add matching fields to the dashboard `Project` type in `mk12-dashboard/src/lib/types.ts`:

```typescript
// Add to existing Project interface:
description?: string
tags?: string[]
sourceUrls?: string[]
```

### Dashboard: useCreateProject hook

Update `useCreateProject()` mutation in `mk12-dashboard/src/hooks/use-project.ts` to accept the full `CreateProjectInput` instead of just `{name}`.

---

## New Components

| File | Purpose |
|------|---------|
| `src/app/new-project/page.tsx` | Page component for the creation route |
| `src/components/project/CreateProjectForm.tsx` | The form: manages state, validation, submission |
| `src/components/project/VideoUploadZone.tsx` | Multi-video upload area (drag-drop, file picker, folder, URL, bulk URL) |
| `src/components/project/TagInput.tsx` | Tag input with pills and remove buttons |

---

## Error Handling & Edge Cases

| Scenario | Behavior |
|----------|----------|
| Large file list (>20 videos) | Virtualized list rendering |
| Failed URL validation | Inline error under URL input, doesn't block other URLs |
| Duplicate file/URL | Toast warning, skip duplicate, keep rest |
| Network error on create | Error toast with retry, form state preserved |
| Navigation with unsaved data | Confirmation dialog on Cancel or browser navigation |
| Empty videos | Allowed — create project with name only, add videos on upload page later |

---

## Post-Creation Flow

1. User fills form, clicks "Create Project"
2. `POST /api/projects` with all form data
3. Backend creates Project (in-memory + Neo4j), creates Video nodes for any paths/URLs
4. Dashboard receives new project ID
5. Redirect to `/project/[id]/upload` where user can add more videos or proceed to pipeline

---

## Dashboard Home Page Update

Replace the current "New Project" button behavior:
- **Before**: `createProject.mutate({name: "New Project {timestamp}"})`
- **After**: `router.push("/new-project")`

The "New Project" button becomes a navigation link, not a mutation trigger.

---

## Out of Scope

- Video file upload to server (videos are referenced by path/URL, not uploaded as binary)
- Auto-detection of FPS/resolution from video files
- Project templates or presets
- Batch project creation
