"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Loader2,
  Film,
  X,
  LayoutGrid,
  List,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { AuthGuard } from "@/lib/auth-guard";
import { useProjects, useDeleteProject } from "@/hooks/use-project";
import { cn } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/lib/types";
import {
  VIEW_KEY,
  FILTER_TABS,
  getStatusConfig,
  type ViewMode,
  type SortField,
  type SortDir,
} from "@/components/dashboard/constants";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { ProjectTable } from "@/components/dashboard/ProjectTable";
import { DeleteConfirmDialog } from "@/components/dashboard/DeleteConfirmDialog";
import { DashboardBulkBar } from "@/components/dashboard/DashboardBulkBar";
import { Toast } from "@/components/dashboard/Toast";

// ---------------------------------------------------------------------------
// useDebounce
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();

  // ─── View mode ─────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "cards";
    const stored = localStorage.getItem(VIEW_KEY);
    return stored === "table" ? "table" : "cards";
  });
  const toggleView = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  }, []);

  // ─── Search ────────────────────────────────────────────────────────
  const [searchRaw, setSearchRaw] = useState("");
  const search = useDebounce(searchRaw, 300);

  // ─── Filters & sort ───────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("asc");
      }
    },
    [sortField],
  );

  // ─── Selection (table bulk actions) ───────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ─── Dialogs ──────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const handleDismissToast = useCallback(() => setToast(null), []);

  // ─── Bulk delete ──────────────────────────────────────────────────
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<string | null>(null);

  // ─── API hooks ────────────────────────────────────────────────────
  // ─── Pagination ───────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortField, sortDir]);

  const { data, isLoading } = useProjects({
    search: search || undefined,
    status: statusFilter,
    sortBy: sortField,
    sortDir,
    page,
    limit: PAGE_SIZE,
  });
  const deleteProject = useDeleteProject();

  const projects = data?.data ?? [];
  const totalFiltered = data?.total ?? 0;
  const totalAll = data?.total ?? 0;
  const hasMore = data?.hasMore ?? false;

  // ─── Filter + search + sort ───────────────────────────────────────
  // Server-side filtering/sorting — `projects` is already filtered and sorted
  const filtered = projects;

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, search]);

  // Toggle-all for table
  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map((p) => p.id));
    });
  }, [filtered]);

  // ─── Delete handler ───────────────────────────────────────────────
  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    deleteProject.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        setToast(`"${name}" has been deleted`);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(deleteTarget.id);
          return next;
        });
      },
      onError: (err) => {
        console.error("Delete failed:", err);
        alert(`Failed to delete project: ${err.message || "Unknown error"}`);
      },
    });
  }, [deleteTarget, deleteProject]);

  // ─── Bulk delete handler ──────────────────────────────────────────
  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkDeleting(true);
    for (let i = 0; i < ids.length; i++) {
      setBulkDeleteProgress(`Deleting ${i + 1} of ${ids.length}...`);
      try {
        await deleteProject.mutateAsync(ids[i]);
      } catch (err) {
        console.error(`Failed to delete project ${ids[i]}:`, err);
      }
    }
    setIsBulkDeleting(false);
    setBulkDeleteProgress(null);
    setSelectedIds(new Set());
    setToast(`${ids.length} project${ids.length !== 1 ? "s" : ""} deleted`);
  }, [selectedIds, deleteProject]);

  // ─── Empty state type ─────────────────────────────────────────────
  const emptyType: "loading" | "no-projects" | "no-search" | "no-filter" | null =
    isLoading
      ? "loading"
      : totalAll === 0 && !search && statusFilter === "all"
        ? "no-projects"
        : totalFiltered === 0
          ? search
            ? "no-search"
            : "no-filter"
          : null;

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <AuthGuard>
      <div className="flex h-screen flex-col">
        <Header />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
            {/* ── Top bar ────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold">Projects</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage your pedagogical video editing projects
                </p>
              </div>
              <Button onClick={() => router.push("/new-project")}>
                <Plus className="size-4" />
                New Project
              </Button>
            </div>

            {/* ── Search + View toggle ───────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
              <div className="relative flex-1 w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or description..."
                  value={searchRaw}
                  onChange={(e) => setSearchRaw(e.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-input pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                {searchRaw && (
                  <button
                    type="button"
                    onClick={() => setSearchRaw("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {/* Result count */}
                {!isLoading && totalFiltered > 0 && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap mr-2">
                    Showing {filtered.length} of {totalFiltered} project{totalFiltered !== 1 ? "s" : ""}
                  </span>
                )}

                {/* View toggle */}
                <div className="flex rounded-md border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleView("cards")}
                    className={cn(
                      "p-1.5 transition-colors",
                      viewMode === "cards"
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    )}
                    title="Card view"
                  >
                    <LayoutGrid className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleView("table")}
                    className={cn(
                      "p-1.5 transition-colors",
                      viewMode === "table"
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    )}
                    title="Table view"
                  >
                    <List className="size-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Status filter tabs ─────────────────────────────── */}
            <div className="flex gap-1 flex-wrap mb-6">
              {FILTER_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    statusFilter === key
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}
                >
                  {label}
                  {key === "all" && totalAll > 0 && (
                    <span className="ml-1.5 text-[10px] opacity-70">({totalAll})</span>
                  )}
                  {key === statusFilter && key !== "all" && (
                    <span className="ml-1.5 text-[10px] opacity-70">({totalFiltered})</span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Content ────────────────────────────────────────── */}
            {emptyType === "loading" ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : emptyType === "no-projects" ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="rounded-2xl bg-muted/50 p-6 mb-5">
                  <FolderOpen className="size-12 text-muted-foreground/50" />
                </div>
                <h2 className="text-lg font-semibold mb-1">No projects yet</h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  Create your first project to get started with AI-powered pedagogical video editing.
                </p>
                <Button onClick={() => router.push("/new-project")}>
                  <Plus className="size-4" />
                  Create Your First Project
                </Button>
              </div>
            ) : emptyType === "no-search" ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Search className="size-10 text-muted-foreground/40 mb-4" />
                <h2 className="text-base font-semibold mb-1">No projects match your search</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Try a different search term or clear the search.
                </p>
                <Button variant="outline" size="sm" onClick={() => setSearchRaw("")}>
                  <X className="size-3.5" />
                  Clear Search
                </Button>
              </div>
            ) : emptyType === "no-filter" ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Film className="size-10 text-muted-foreground/40 mb-4" />
                <h2 className="text-base font-semibold mb-1">
                  No {getStatusConfig(statusFilter === "all" ? "created" : statusFilter).label.toLowerCase()} projects
                </h2>
                <p className="text-sm text-muted-foreground">
                  No projects currently have this status.
                </p>
              </div>
            ) : viewMode === "cards" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>
            ) : (
              <ProjectTable
                projects={filtered}
                selectedIds={selectedIds}
                onToggle={toggleSelect}
                onToggleAll={toggleAll}
                onDelete={setDeleteTarget}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
              />
            )}

            {/* ── Pagination ──────────────────────────────────────── */}
            {totalFiltered > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {Math.ceil(totalFiltered / PAGE_SIZE)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMore}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </main>

        {/* ── Bulk action bar ────────────────────────────────────── */}
        <DashboardBulkBar
          count={selectedIds.size}
          onDelete={handleBulkDelete}
          onClear={() => setSelectedIds(new Set())}
          isDeleting={isBulkDeleting}
          deleteProgress={bulkDeleteProgress}
        />

        {/* ── Toast ──────────────────────────────────────────────── */}
        {toast && <Toast message={toast} onDismiss={handleDismissToast} />}

        {/* ── Delete Confirmation Dialog ─────────────────────────── */}
        <DeleteConfirmDialog
          project={deleteTarget}
          isPending={deleteProject.isPending}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    </AuthGuard>
  );
}
