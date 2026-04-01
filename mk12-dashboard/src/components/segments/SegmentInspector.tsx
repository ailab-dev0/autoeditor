"use client";

import {
  Clock,
  Brain,
  Volume2,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SegmentBadge } from "./SegmentBadge";
import { ConfidenceBar } from "@/components/shared/ConfidenceBar";
import { ConceptTag } from "@/components/shared/ConceptTag";
import { cn } from "@/lib/utils";
import type { Segment } from "@/lib/types";

interface SegmentInspectorProps {
  segment: Segment | null;
  onApprove: (segmentId: string) => void;
  onReject: (segmentId: string) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
  className?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(start: number, end: number): string {
  const d = end - start;
  if (d < 60) return `${d.toFixed(1)}s`;
  const m = Math.floor(d / 60);
  const s = Math.round(d % 60);
  return `${m}m ${s}s`;
}

function Section({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}

export function SegmentInspector({
  segment,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  className,
}: SegmentInspectorProps) {
  if (!segment) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center text-muted-foreground text-sm",
          className,
        )}
      >
        Select a segment to inspect
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col overflow-y-auto", className)}>
      {/* Header */}
      <div className="border-b border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-muted-foreground">
              #{segment.index}
            </span>
            <SegmentBadge decision={segment.decision} size="md" />
          </div>
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full",
              segment.approvalStatus === "approved" && "bg-green-400/15 text-green-400",
              segment.approvalStatus === "rejected" && "bg-red-400/15 text-red-400",
              segment.approvalStatus === "overridden" && "bg-yellow-400/15 text-yellow-400",
              segment.approvalStatus === "pending" && "bg-muted text-muted-foreground",
            )}
          >
            {segment.approvalStatus}
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1 font-mono">
            <Clock className="size-3.5" />
            {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
          </span>
          <span className="text-xs">
            ({formatDuration(segment.startTime, segment.endTime)})
          </span>
        </div>

        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Confidence</span>
          <ConfidenceBar value={segment.confidence} showLabel size="md" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-5 p-4">
        {/* Transcript */}
        <Section icon={BookOpen} title="Transcript">
          <p className="text-sm leading-relaxed text-foreground/90">
            {segment.transcript}
          </p>
          {segment.summary && (
            <p className="text-xs italic text-muted-foreground">
              {segment.summary}
            </p>
          )}
        </Section>

        {/* AI Decision Explanation */}
        <Section icon={Brain} title="AI Decision">
          <p className="text-sm text-foreground/80 leading-relaxed">
            {segment.explanation}
          </p>
        </Section>

        {/* Knowledge */}
        {(segment.conceptLabel || segment.chapterTitle) && (
          <Section icon={BookOpen} title="Knowledge">
            <div className="space-y-2">
              {segment.conceptLabel && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Concept:</span>
                  <ConceptTag
                    label={segment.conceptLabel}
                    communityColor={segment.communityColor}
                    size="sm"
                  />
                </div>
              )}
              {segment.chapterTitle && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Chapter:</span>
                  <span className="text-sm">{segment.chapterTitle}</span>
                </div>
              )}
              {segment.prerequisites && segment.prerequisites.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Prerequisites:</span>
                  <div className="flex flex-wrap gap-1">
                    {segment.prerequisites.map((prereq) => (
                      <span
                        key={prereq}
                        className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
                      >
                        <ChevronRight className="size-3" />
                        {prereq}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Audio Metrics */}
        {segment.audioMetrics && (
          <Section icon={Volume2} title="Audio Metrics">
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Avg Loudness", `${segment.audioMetrics.averageLoudness.toFixed(1)} dB`],
                ["Peak", `${segment.audioMetrics.peakLoudness.toFixed(1)} dB`],
                ["Noise Floor", `${segment.audioMetrics.noiseFloor.toFixed(1)} dB`],
                ["Silence", `${(segment.audioMetrics.silencePercentage * 100).toFixed(0)}%`],
                ["Speech Clarity", `${(segment.audioMetrics.speechClarity * 100).toFixed(0)}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md bg-muted px-2 py-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {label}
                  </div>
                  <div className="text-sm font-medium tabular-nums">{value}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Override reason if present */}
        {segment.overrideReason && (
          <Section icon={AlertTriangle} title="Override Reason">
            <div className="rounded-md border border-yellow-400/20 bg-yellow-400/5 p-2">
              <p className="text-sm text-yellow-400/90">{segment.overrideReason}</p>
            </div>
          </Section>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <Button
            className="flex-1"
            variant={segment.approvalStatus === "approved" ? "secondary" : "default"}
            onClick={() => onApprove(segment.id)}
            loading={isApproving}
            disabled={segment.approvalStatus === "approved"}
          >
            <CheckCircle2 className="size-4" />
            {segment.approvalStatus === "approved" ? "Approved" : "Approve"}
          </Button>
          <Button
            className="flex-1"
            variant="destructive"
            onClick={() => onReject(segment.id)}
            loading={isRejecting}
            disabled={segment.approvalStatus === "rejected"}
          >
            <XCircle className="size-4" />
            {segment.approvalStatus === "rejected" ? "Rejected" : "Reject"}
          </Button>
        </div>
      </div>
    </div>
  );
}
