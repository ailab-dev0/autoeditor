"use client";

/**
 * Mobile Project Review — vertical segment cards with approve/reject.
 *
 * Optimized for mobile:
 * - Vertical segment cards with transcript, confidence, and decision badges
 * - Tap to expand: full transcript + AI explanation + approve/reject buttons
 * - Swipe right = approve, swipe left = reject
 * - Pull-to-refresh for live updates
 * - Bottom nav: Segments | Marks | Export
 */

import { use, useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  Layers,
  Tag,
  Download,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Types ──────────────────────────────────────────────────────────

interface MobileSegment {
  id: string;
  index: number;
  startTime: number;
  endTime: number;
  decision: string;
  confidence: number;
  approvalStatus: "pending" | "approved" | "rejected";
  transcript: string;
  explanation: string;
  summary?: string;
}

type MobileTab = "segments" | "marks" | "export";

// ─── Decision colors ────────────────────────────────────────────────

const DECISION_COLORS: Record<string, string> = {
  keep: "bg-green-400/15 text-green-400 border-green-400/30",
  cut: "bg-red-400/15 text-red-400 border-red-400/30",
  trim: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",
  trim_start: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",
  trim_end: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",
  rearrange: "bg-purple-400/15 text-purple-400 border-purple-400/30",
  speed_up: "bg-blue-400/15 text-blue-400 border-blue-400/30",
  review: "bg-orange-400/15 text-orange-400 border-orange-400/30",
};

// ─── Helpers ────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ─── Segment Card ───────────────────────────────────────────────────

function SegmentCard({
  segment,
  isExpanded,
  onToggle,
  onApprove,
  onReject,
  isActing,
}: {
  segment: MobileSegment;
  isExpanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  isActing: boolean;
}) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    // Only allow horizontal swipe if mostly horizontal
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      setSwipeOffset(Math.max(-100, Math.min(100, dx)));
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset > 60) {
      onApprove();
    } else if (swipeOffset < -60) {
      onReject();
    }
    setSwipeOffset(0);
  };

  const approvalIcon =
    segment.approvalStatus === "approved" ? (
      <CheckCircle2 className="size-4 text-green-400" />
    ) : segment.approvalStatus === "rejected" ? (
      <XCircle className="size-4 text-red-400" />
    ) : (
      <Clock className="size-4 text-muted-foreground" />
    );

  const swipeBg =
    swipeOffset > 30
      ? "bg-green-500/10"
      : swipeOffset < -30
        ? "bg-red-500/10"
        : "";

  return (
    <div
      ref={cardRef}
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden transition-colors",
        swipeBg,
        segment.approvalStatus === "approved" && "border-green-400/20",
        segment.approvalStatus === "rejected" && "border-red-400/20",
      )}
      style={{
        transform: `translateX(${swipeOffset * 0.3}px)`,
        transition: swipeOffset === 0 ? "transform 0.3s ease" : "none",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Card header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 active:bg-accent/20"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {approvalIcon}
            <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
              {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
            </span>
            <span
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                DECISION_COLORS[segment.decision] ?? DECISION_COLORS.review,
              )}
            >
              {segment.decision.replace("_", " ")}
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="size-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground shrink-0" />
          )}
        </div>

        {/* Transcript excerpt */}
        <p className={cn(
          "text-xs text-foreground/80 mt-1.5 leading-relaxed",
          !isExpanded && "line-clamp-2",
        )}>
          {segment.transcript || "No transcript available"}
        </p>

        {/* Confidence bar */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                segment.confidence >= 80
                  ? "bg-green-400"
                  : segment.confidence >= 50
                    ? "bg-yellow-400"
                    : "bg-red-400",
              )}
              style={{ width: `${segment.confidence}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
            {segment.confidence}%
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border-dim px-4 py-3 space-y-3">
          {/* AI Explanation */}
          {segment.explanation && (
            <div className="rounded-lg bg-accent/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                AI Explanation
              </p>
              <p className="text-xs text-foreground/80 leading-relaxed">
                {segment.explanation}
              </p>
            </div>
          )}

          {/* Full transcript */}
          {segment.transcript && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Full Transcript
              </p>
              <p className="text-xs text-foreground/70 leading-relaxed">
                {segment.transcript}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={(e) => { e.stopPropagation(); onApprove(); }}
              disabled={isActing || segment.approvalStatus === "approved"}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-95",
                segment.approvalStatus === "approved"
                  ? "bg-green-400/20 text-green-400"
                  : "bg-green-500 text-white active:bg-green-600",
              )}
            >
              <CheckCircle2 className="size-5" />
              {segment.approvalStatus === "approved" ? "Approved" : "Approve"}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReject(); }}
              disabled={isActing || segment.approvalStatus === "rejected"}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-95",
                segment.approvalStatus === "rejected"
                  ? "bg-red-400/20 text-red-400"
                  : "bg-red-500 text-white active:bg-red-600",
              )}
            >
              <XCircle className="size-5" />
              {segment.approvalStatus === "rejected" ? "Rejected" : "Reject"}
            </button>
          </div>

          {/* Swipe hint */}
          <p className="text-center text-[10px] text-muted-foreground/50">
            Swipe right to approve, left to reject
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function MobileProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);

  const [segments, setSegments] = useState<MobileSegment[]>([]);
  const [projectName, setProjectName] = useState("Loading...");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MobileTab>("segments");

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [projectRes, segmentsRes] = await Promise.all([
        fetch(`${API_URL}/api/projects/${projectId}`),
        fetch(`${API_URL}/api/projects/${projectId}/segments`),
      ]);

      const projectData = await projectRes.json();
      const segData = await segmentsRes.json();

      const rawProject = projectData.project ?? projectData;
      setProjectName(rawProject.name ?? "Untitled");

      const rawSegments = segData.segments ?? (Array.isArray(segData) ? segData : []);
      setSegments(
        rawSegments.map((s: Record<string, unknown>, i: number) => ({
          id: s.id as string,
          index: i,
          startTime: (s.start as number) ?? (s.startTime as number) ?? 0,
          endTime: (s.end as number) ?? (s.endTime as number) ?? 0,
          decision: (s.suggestion as string) ?? (s.decision as string) ?? "review",
          confidence: normalizeConfidence(s.confidence as number),
          approvalStatus: s.approved
            ? "approved"
            : s.rejected
              ? "rejected"
              : "pending",
          transcript: (s.transcript as string) ?? "",
          explanation: (s.explanation as string) ?? "",
          summary: s.summary as string | undefined,
        })),
      );
    } catch {
      // Offline / error
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = useCallback(
    async (segmentId: string) => {
      setActingId(segmentId);
      try {
        await fetch(`${API_URL}/api/projects/${projectId}/segments/${segmentId}/approve`, {
          method: "PUT",
        });
        setSegments((prev) =>
          prev.map((s) =>
            s.id === segmentId ? { ...s, approvalStatus: "approved" } : s,
          ),
        );
      } catch {
        // Error handling
      } finally {
        setActingId(null);
      }
    },
    [projectId],
  );

  const handleReject = useCallback(
    async (segmentId: string) => {
      setActingId(segmentId);
      try {
        await fetch(`${API_URL}/api/projects/${projectId}/segments/${segmentId}/reject`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        setSegments((prev) =>
          prev.map((s) =>
            s.id === segmentId ? { ...s, approvalStatus: "rejected" } : s,
          ),
        );
      } catch {
        // Error handling
      } finally {
        setActingId(null);
      }
    },
    [projectId],
  );

  // Stats
  const stats = useMemo(() => {
    const total = segments.length;
    const approved = segments.filter((s) => s.approvalStatus === "approved").length;
    const rejected = segments.filter((s) => s.approvalStatus === "rejected").length;
    const pending = total - approved - rejected;
    return { total, approved, rejected, pending };
  }, [segments]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/mobile"
              className="p-1 rounded-full hover:bg-accent active:bg-accent/70"
            >
              <ChevronLeft className="size-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-sm font-bold truncate max-w-[200px]">
                {projectName}
              </h1>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="text-green-400">{stats.approved} approved</span>
                <span>|</span>
                <span className="text-red-400">{stats.rejected} rejected</span>
                <span>|</span>
                <span>{stats.pending} pending</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="p-2 rounded-full hover:bg-accent active:bg-accent/70"
          >
            <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
          <div className="flex h-full">
            <div
              className="bg-green-400 transition-all"
              style={{ width: `${stats.total > 0 ? (stats.approved / stats.total) * 100 : 0}%` }}
            />
            <div
              className="bg-red-400 transition-all"
              style={{ width: `${stats.total > 0 ? (stats.rejected / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </header>

      {/* Tab content */}
      <main className="flex-1 overflow-y-auto px-4 py-3 pb-20">
        {activeTab === "segments" && (
          <div className="space-y-2">
            {segments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <AlertTriangle className="size-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No segments found</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Run the pipeline to generate segments
                </p>
              </div>
            ) : (
              segments.map((segment) => (
                <SegmentCard
                  key={segment.id}
                  segment={segment}
                  isExpanded={expandedId === segment.id}
                  onToggle={() =>
                    setExpandedId((prev) => (prev === segment.id ? null : segment.id))
                  }
                  onApprove={() => handleApprove(segment.id)}
                  onReject={() => handleReject(segment.id)}
                  isActing={actingId === segment.id}
                />
              ))
            )}
          </div>
        )}

        {activeTab === "marks" && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Tag className="size-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Content Marks</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              View content marks on desktop for full editing
            </p>
          </div>
        )}

        {activeTab === "export" && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Download className="size-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">Export</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Export functionality available on desktop
            </p>
          </div>
        )}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 bg-background/80 backdrop-blur-md border-t border-border z-30">
        <div className="flex items-center justify-around py-2 pb-safe">
          <TabButton
            icon={Layers}
            label="Segments"
            active={activeTab === "segments"}
            badge={stats.pending > 0 ? stats.pending : undefined}
            onClick={() => setActiveTab("segments")}
          />
          <TabButton
            icon={Tag}
            label="Marks"
            active={activeTab === "marks"}
            onClick={() => setActiveTab("marks")}
          />
          <TabButton
            icon={Download}
            label="Export"
            active={activeTab === "export"}
            onClick={() => setActiveTab("export")}
          />
        </div>
      </nav>
    </div>
  );
}

function TabButton({
  icon: Icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: typeof Layers;
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-colors relative",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" />
      <span className="text-[10px] font-medium">{label}</span>
      {badge != null && badge > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-primary text-[9px] text-primary-foreground font-bold flex items-center justify-center px-1">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

function normalizeConfidence(value: number | undefined): number {
  if (value == null) return 0;
  if (value <= 1) return Math.round(value * 100);
  return Math.round(value);
}
