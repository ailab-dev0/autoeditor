import {
  Film,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { ProjectStatus } from "@/lib/types";

export type ViewMode = "cards" | "table";
export type SortField = "name" | "status" | "createdAt";
export type SortDir = "asc" | "desc";

export const VIEW_KEY = "mk12_dashboard_view";

export const STATUS_CONFIG: Record<
  ProjectStatus,
  { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; label: string }
> = {
  created:   { icon: Film,         color: "text-gray-400",   bg: "bg-gray-400/15",   label: "New" },
  analyzing: { icon: Loader2,      color: "text-primary",    bg: "bg-primary/15",    label: "Analyzing" },
  ready:     { icon: CheckCircle2, color: "text-green-400",  bg: "bg-green-400/15",  label: "Ready" },
  exporting: { icon: Loader2,      color: "text-purple-400", bg: "bg-purple-400/15", label: "Exporting" },
  error:     { icon: AlertCircle,  color: "text-red-400",    bg: "bg-red-400/15",    label: "Error" },
};

export const FILTER_TABS: Array<{ key: ProjectStatus | "all"; label: string }> = [
  { key: "all",       label: "All" },
  { key: "created",   label: "New" },
  { key: "analyzing", label: "Analyzing" },
  { key: "ready",     label: "Ready" },
  { key: "exporting", label: "Exporting" },
  { key: "error",     label: "Error" },
];

export function getStatusConfig(status: string) {
  return STATUS_CONFIG[status as ProjectStatus] ?? STATUS_CONFIG.created;
}

export function isAnimatedStatus(status: string) {
  return status === "analyzing" || status === "exporting";
}

export function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function videoCount(project: { videoPaths?: string[]; sourceUrls?: string[] }): number {
  const videoPaths: string[] = project.videoPaths ?? [];
  const sourceUrls = project.sourceUrls ?? [];
  return videoPaths.length + sourceUrls.length;
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen).trimEnd() + "...";
}
