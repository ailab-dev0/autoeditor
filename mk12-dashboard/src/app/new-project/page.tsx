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

      const filePaths = videos.map((v) => v.value);

      createProject.mutate(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          brief: brief.trim() || undefined,
          videoPaths: filePaths.length > 0 ? filePaths : undefined,
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
