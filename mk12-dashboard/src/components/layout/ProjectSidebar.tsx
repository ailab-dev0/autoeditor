"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Upload,
  GitBranch,
  Eye,
  Network,
  FileText,
  Bookmark,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectCosts } from "@/hooks/use-costs";
import { CostBadge } from "@/components/shared/CostBadge";

interface ProjectSidebarProps {
  projectId: string;
  projectName?: string;
  projectStatus?: string;
  className?: string;
}

const NAV_ITEMS = [
  { label: "Upload", href: "upload", icon: Upload },
  { label: "Pipeline", href: "pipeline", icon: GitBranch },
  { label: "Review", href: "review", icon: Eye },
  { label: "Knowledge", href: "knowledge", icon: Network },
  { label: "Transcript", href: "transcript", icon: FileText },
  { label: "Marks", href: "marks", icon: Bookmark },
  { label: "Export", href: "export", icon: Download },
];

export function ProjectSidebar({
  projectId,
  projectName,
  projectStatus,
  className,
}: ProjectSidebarProps) {
  const pathname = usePathname();
  const { data: costs } = useProjectCosts(projectId);

  return (
    <aside
      className={cn(
        "flex w-56 flex-col border-r border-border bg-background",
        className,
      )}
    >
      {/* Project info header */}
      <div className="border-b border-border p-4">
        <h2 className="text-sm font-semibold truncate">{projectName ?? "Project"}</h2>
        {projectStatus && (
          <span
            className={cn(
              "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              projectStatus === "created" && "bg-gray-400/15 text-gray-400",
              projectStatus === "analyzing" && "bg-primary/15 text-primary",
              projectStatus === "ready" && "bg-green-400/15 text-green-400",
              projectStatus === "exporting" && "bg-purple-400/15 text-purple-400",
              projectStatus === "error" && "bg-red-400/15 text-red-400",
            )}
          >
            {projectStatus}
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const href = `/project/${projectId}/${item.href}`;
          const isActive = pathname === href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Cost summary */}
      {costs && costs.totalUsd > 0 && (
        <div className="border-t border-border p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">API Cost</span>
            <CostBadge costUsd={costs.totalUsd} size="md" />
          </div>
          {Object.entries(costs.byService).map(([service, data]) => (
            <div key={service} className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground capitalize">{service}</span>
              <span className="text-muted-foreground font-mono tabular-nums">{data.count}× · ${data.costUsd.toFixed(4)}</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
