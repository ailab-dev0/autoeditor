"use client";

import Link from "next/link";
import { Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { formatRelativeTime, videoCount, truncate } from "./constants";
import type { SortField, SortDir } from "./constants";

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
}) {
  if (field !== sortField) return <ArrowUpDown className="size-3 text-muted-foreground/40" />;
  return sortDir === "asc" ? (
    <ArrowUp className="size-3 text-primary" />
  ) : (
    <ArrowDown className="size-3 text-primary" />
  );
}

export function ProjectTable({
  projects,
  selectedIds,
  onToggle,
  onToggleAll,
  onDelete,
  sortField,
  sortDir,
  onSort,
}: {
  projects: Project[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onDelete: (p: Project) => void;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const allSelected = projects.length > 0 && selectedIds.size === projects.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <th className="w-10 px-3 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={onToggleAll}
                className="size-3.5 rounded border-border accent-primary cursor-pointer"
              />
            </th>
            <th className="px-3 py-3">
              <button
                type="button"
                onClick={() => onSort("name")}
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              >
                Name
                <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
              </button>
            </th>
            <th className="px-3 py-3">
              <button
                type="button"
                onClick={() => onSort("status")}
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              >
                Status
                <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
              </button>
            </th>
            <th className="px-3 py-3">Videos</th>
            <th className="px-3 py-3">Segments</th>
            <th className="px-3 py-3 hidden lg:table-cell">Description</th>
            <th className="px-3 py-3">
              <button
                type="button"
                onClick={() => onSort("createdAt")}
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              >
                Created
                <SortIcon field="createdAt" sortField={sortField} sortDir={sortDir} />
              </button>
            </th>
            <th className="w-12 px-3 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {projects.map((p) => {
            const vCount = videoCount(p);
            return (
              <tr
                key={p.id}
                className={cn(
                  "transition-colors hover:bg-accent/30",
                  selectedIds.has(p.id) && "bg-primary/5",
                )}
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => onToggle(p.id)}
                    className="size-3.5 rounded border-border accent-primary cursor-pointer"
                  />
                </td>
                <td className="px-3 py-3 font-medium">
                  <Link
                    href={`/project/${p.id}/review`}
                    className="hover:text-primary transition-colors"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-3 py-3 tabular-nums text-muted-foreground">
                  {vCount}
                </td>
                <td className="px-3 py-3 tabular-nums text-muted-foreground">
                  {p.segmentCount ?? 0}
                </td>
                <td className="px-3 py-3 hidden lg:table-cell text-muted-foreground max-w-[200px]">
                  <span className="block truncate">
                    {p.description ? truncate(p.description, 60) : "--"}
                  </span>
                </td>
                <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                  {p.createdAt ? formatRelativeTime(p.createdAt) : "--"}
                </td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onDelete(p)}
                    className="rounded-md p-1.5 text-muted-foreground/60 transition-all hover:bg-destructive/15 hover:text-red-400"
                    title="Delete project"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
