"use client";

import { useState, useCallback } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProjects, useDeleteProject } from "@/hooks/use-project";
import { useAllProjectCosts } from "@/hooks/use-costs";
import { CostBadge } from "@/components/shared/CostBadge";

export default function RepositoryPage() {
  const { data, isLoading } = useProjects({ page: 1, limit: 100 });
  const { data: costMap } = useAllProjectCosts();
  const projects = data?.data ?? [];
  const deleteProject = useDeleteProject();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectMode = selected.size > 0;
  const allSelected = projects.length > 0 && selected.size === projects.length;

  const toggleOne = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(projects.map(p => p.id)));
    }
  }, [allSelected, projects]);

  const handleDelete = (id: string) => {
    deleteProject.mutate(id, {
      onSettled: () => setConfirmId(null),
    });
  };

  const handleBulkDelete = useCallback(async () => {
    setDeleting(true);
    const ids = Array.from(selected);
    for (const id of ids) {
      try {
        await deleteProject.mutateAsync(id);
      } catch (err) {
        console.error(`[repository] Failed to delete ${id}:`, (err as Error).message);
      }
    }
    setSelected(new Set());
    setBulkConfirm(false);
    setDeleting(false);
  }, [selected, deleteProject]);

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold mb-1">Repository</h1>
              <p className="text-sm text-muted-foreground">
                Browse all edit packages and analysis results
              </p>
            </div>
          </div>

          {/* Bulk action bar */}
          {selectMode && (
            <div className="flex items-center gap-3 mb-4 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
              <span className="text-sm font-medium">
                {selected.size} selected
              </span>
              <div className="flex-1" />
              {bulkConfirm ? (
                <>
                  <span className="text-sm text-red-400">
                    Delete {selected.size} project{selected.size !== 1 ? "s" : ""}?
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleting}
                    onClick={handleBulkDelete}
                  >
                    {deleting ? <Loader2 className="size-3 animate-spin mr-1" /> : <Trash2 className="size-3 mr-1" />}
                    Confirm Delete
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setBulkConfirm(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => setBulkConfirm(true)}
                  >
                    <Trash2 className="size-3 mr-1" />
                    Delete Selected
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                </>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="size-4 rounded border-border accent-primary cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Segments</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Updated</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Cost</th>
                    <th className="px-4 py-3 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr
                      key={project.id}
                      className={cn(
                        "border-b border-border-dim transition-colors",
                        selected.has(project.id) ? "bg-primary/5" : "hover:bg-accent/20",
                      )}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(project.id)}
                          onChange={() => toggleOne(project.id)}
                          className="size-4 rounded border-border accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{project.name}</td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">{project.status}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {project.segmentCount ?? "--"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <CostBadge costUsd={costMap?.[project.id]} />
                      </td>
                      <td className="px-4 py-3">
                        {confirmId === project.id ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={deleteProject.isPending}
                              onClick={() => handleDelete(project.id)}
                            >
                              {deleteProject.isPending ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                "Delete"
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setConfirmId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmId(project.id)}
                            className="rounded p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete project"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
