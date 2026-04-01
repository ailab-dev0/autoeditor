"use client";

import {
  Mic,
  Network,
  GraduationCap,
  Clapperboard,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatStageName } from "@/lib/types";
import type { PipelineStage, PipelineStageName, PipelineStageStatus } from "@/lib/types";

interface PipelineProgressProps {
  stages: PipelineStage[];
  overallProgress: number;
  eta?: number;
  className?: string;
}

const STAGE_ICONS: Record<PipelineStageName, React.ComponentType<{ className?: string }>> = {
  transcription: Mic,
  knowledge_graph: Network,
  chapter_validation: GraduationCap,
  director_decisions: Clapperboard,
};

function StatusIcon({ status }: { status: PipelineStageStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="size-4 text-green-400" />;
    case "running":
      return <Loader2 className="size-4 text-primary animate-spin" />;
    case "error":
      return <AlertCircle className="size-4 text-red-400" />;
    case "skipped":
      return <Clock className="size-4 text-muted-foreground-dim" />;
    default:
      return <Clock className="size-4 text-muted-foreground-dim" />;
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `~${Math.round(seconds)}s remaining`;
  const m = Math.ceil(seconds / 60);
  return `~${m}m remaining`;
}

export function PipelineProgress({
  stages,
  overallProgress,
  eta,
  className,
}: PipelineProgressProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Overall progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Overall Progress</span>
          <div className="flex items-center gap-3">
            {eta != null && eta > 0 && (
              <span className="text-xs text-muted-foreground">{formatEta(eta)}</span>
            )}
            <span className="text-sm font-semibold tabular-nums">{overallProgress}%</span>
          </div>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-primary-hover transition-all duration-500 ease-out"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Stage list */}
      <div className="space-y-1">
        {stages.map((stage, i) => {
          const Icon = STAGE_ICONS[stage.name] ?? Clock;
          const label = stage.label || formatStageName(stage.name);
          const isRunning = stage.status === "running";
          const isCompleted = stage.status === "completed";

          return (
            <div
              key={stage.name}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                isRunning && "bg-primary/5 border border-primary/20",
                !isRunning && "border border-transparent",
              )}
            >
              {/* Step number + icon */}
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  isCompleted && "bg-green-400/15",
                  isRunning && "bg-primary/15",
                  stage.status === "error" && "bg-red-400/15",
                  stage.status === "pending" && "bg-muted",
                  stage.status === "skipped" && "bg-muted",
                )}
              >
                <Icon
                  className={cn(
                    "size-4",
                    isCompleted && "text-green-400",
                    isRunning && "text-primary",
                    stage.status === "error" && "text-red-400",
                    stage.status === "pending" && "text-muted-foreground-dim",
                  )}
                />
              </div>

              {/* Label + progress */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      stage.status === "pending" && "text-muted-foreground",
                    )}
                  >
                    {label}
                  </span>
                  <StatusIcon status={stage.status} />
                </div>
                {isRunning && (
                  <div className="mt-1.5">
                    <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${stage.progress}%` }}
                      />
                    </div>
                  </div>
                )}
                {stage.duration != null && stage.duration > 0 && isCompleted && (
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(stage.duration)}
                  </span>
                )}
                {stage.error && (
                  <span className="text-xs text-red-400">{stage.error}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
