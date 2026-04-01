"use client";

import { use } from "react";
import { Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { PipelineProgress } from "@/components/pipeline/PipelineProgress";
import { usePipeline, useStartPipeline } from "@/hooks/use-pipeline";
import type { PipelineStage } from "@/lib/types";

import { STAGE_DISPLAY_NAMES } from "@/lib/types";

const DEFAULT_STAGES: PipelineStage[] = [
  { name: "transcription", label: STAGE_DISPLAY_NAMES.transcription, status: "pending", progress: 0 },
  { name: "knowledge_graph", label: STAGE_DISPLAY_NAMES.knowledge_graph, status: "pending", progress: 0 },
  { name: "chapter_validation", label: STAGE_DISPLAY_NAMES.chapter_validation, status: "pending", progress: 0 },
  { name: "director_decisions", label: STAGE_DISPLAY_NAMES.director_decisions, status: "pending", progress: 0 },
];

export default function PipelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const pipeline = usePipeline(projectId);
  const startPipeline = useStartPipeline(projectId);

  const stages = pipeline.stages.length > 0 ? pipeline.stages : DEFAULT_STAGES;
  const overallProgress = pipeline.overallProgress;

  const isRunning = stages.some((s) => s.status === "running");
  const isComplete = overallProgress === 100 && stages.every((s) => s.status === "completed" || s.status === "skipped");
  const hasError = stages.some((s) => s.status === "error");

  return (
    <PageLayout
      title="Analysis Pipeline"
      description="AI-powered analysis of your video content"
      actions={
        <Button
          onClick={() => startPipeline.mutate()}
          loading={startPipeline.isPending}
          disabled={isRunning}
          variant={isComplete ? "outline" : "default"}
        >
          {isComplete ? (
            <>
              <RotateCcw className="size-4" />
              Re-run Pipeline
            </>
          ) : (
            <>
              <Play className="size-4" />
              {isRunning ? "Running..." : "Start Pipeline"}
            </>
          )}
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl">
        <PipelineProgress
          stages={stages}
          overallProgress={overallProgress}
          eta={pipeline.eta}
        />

        {/* SSE connection indicator */}
        {isRunning && (
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`size-2 rounded-full ${
                pipeline.sseStatus === "connected"
                  ? "bg-green-400"
                  : pipeline.sseStatus === "auth_error"
                    ? "bg-red-400"
                    : "bg-yellow-400"
              }`}
            />
            {pipeline.sseStatus === "connected" && "Live updates connected"}
            {pipeline.sseStatus === "reconnecting" && "Live updates interrupted — reconnecting..."}
            {pipeline.sseStatus === "polling" && "Live updates unavailable — polling for updates"}
            {pipeline.sseStatus === "auth_error" && "Session expired — please refresh the page"}
            {pipeline.sseStatus === "idle" && "Waiting for pipeline..."}
          </div>
        )}

        {hasError && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-400">
            One or more pipeline stages encountered an error. You can re-run the pipeline to retry.
          </div>
        )}
      </div>
    </PageLayout>
  );
}
