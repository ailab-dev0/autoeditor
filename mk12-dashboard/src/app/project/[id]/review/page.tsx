"use client";

import { use, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Check, ChevronLeft, ChevronRight, Play,
  Film, Scissors, ArrowLeft, Loader2, RefreshCw,
  AlertTriangle, Sparkles, ImageIcon, Pencil,
} from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { apiClient } from "@/lib/api-client";
import { projectKeys } from "@/hooks/use-project";
import { cn } from "@/lib/utils";
import type {
  SegmentBlueprint,
  BlueprintResponse,
} from "@/lib/types";

// ─── Constants ─────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  hook: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  intro: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  core: "bg-green-500/20 text-green-400 border-green-500/30",
  example: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  filler: "bg-red-500/20 text-red-400 border-red-500/30",
  tangent: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  transition: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  recap: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "deep-dive": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
};

type ReviewFilter = "all" | "pending" | "needs_review";

const blueprintKeys = {
  detail: (projectId: string) => ["blueprint", projectId] as const,
};

// ─── Page ──────────────────────────────────────────────────

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [customNotes, setCustomNotes] = useState("");
  const [showCustomInput, setShowCustomInput] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: blueprintKeys.detail(id),
    queryFn: () => apiClient.blueprint.get(id),
    enabled: !!id,
  });

  const allSegments = data?.blueprint.segments ?? [];
  const stats = data?.reviewStats ?? null;
  const warnings = data?.blueprint.warnings ?? [];

  const needsReviewCount = allSegments.filter(
    s => s.suggestion === "review" || s.aiPath.action === "keep_original" && s.confidence === 0
  ).length;

  const filteredSegments = useMemo(() => {
    switch (filter) {
      case "pending":
        return allSegments.filter(s => !s.userChoice);
      case "needs_review":
        return allSegments.filter(
          s => s.suggestion === "review" || (s.aiPath.action === "keep_original" && s.confidence === 0)
        );
      default:
        return allSegments;
    }
  }, [allSegments, filter]);

  // Handle initial hash navigation
  if (data && selectedIdx === 0 && typeof window !== "undefined" && window.location.hash) {
    const segId = window.location.hash.slice(1);
    const idx = filteredSegments.findIndex(s => s.segmentId === segId);
    if (idx >= 0 && idx !== selectedIdx) setSelectedIdx(idx);
  }

  const choiceMutation = useMutation({
    mutationFn: ({ segId, choice, notes }: { segId: string; choice: "ai" | "original" | "custom"; notes?: string }) =>
      apiClient.blueprint.updateChoice(id, segId, choice, notes),
    onMutate: async ({ segId, choice }) => {
      await queryClient.cancelQueries({ queryKey: blueprintKeys.detail(id) });
      const prev = queryClient.getQueryData<BlueprintResponse>(blueprintKeys.detail(id));
      queryClient.setQueryData<BlueprintResponse>(blueprintKeys.detail(id), old => {
        if (!old) return old;
        return {
          ...old,
          blueprint: {
            ...old.blueprint,
            segments: old.blueprint.segments.map(s =>
              s.segmentId === segId ? { ...s, userChoice: choice } : s
            ),
          },
        };
      });
      return { prev };
    },
    onError: (err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(blueprintKeys.detail(id), context.prev);
      }
      console.error("[review] Failed to update choice:", (err as Error).message);
      showToast("Failed to save your choice. Please try again.");
    },
    onSuccess: (result) => {
      if (result.stats) {
        queryClient.setQueryData<BlueprintResponse>(blueprintKeys.detail(id), old => {
          if (!old) return old;
          return { ...old, reviewStats: result.stats! };
        });
      }
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      setShowCustomInput(null);
      setCustomNotes("");
    },
  });

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const updateChoice = useCallback((segId: string, choice: "ai" | "original" | "custom", notes?: string) => {
    choiceMutation.mutate({ segId, choice, notes });
  }, [choiceMutation]);

  const bulkAcceptAI = useCallback(async () => {
    const pending = allSegments.filter(s => !s.userChoice && s.suggestion !== "cut").map(s => s.segmentId);
    if (pending.length === 0) return;
    try {
      await apiClient.blueprint.bulkUpdate(id, pending, "ai");
      queryClient.invalidateQueries({ queryKey: blueprintKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
    } catch (err) {
      console.error("[review] Bulk accept failed:", (err as Error).message);
      showToast("Bulk accept failed. Please try again.");
    }
  }, [id, allSegments, queryClient, showToast]);

  // Clamp selectedIdx to valid range when filter changes
  const clampedIdx = Math.min(selectedIdx, Math.max(0, filteredSegments.length - 1));
  if (clampedIdx !== selectedIdx && filteredSegments.length > 0) setSelectedIdx(clampedIdx);

  const selected = filteredSegments[clampedIdx];
  const isPending = choiceMutation.isPending && choiceMutation.variables?.segId === selected?.segmentId;

  if (isLoading) {
    return (
      <PageLayout title="Production Review">
        <div className="flex items-center justify-center h-64 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          <span className="text-zinc-400">Loading blueprint...</span>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="Production Review">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertTriangle className="w-8 h-8 text-red-400" />
          <p className="text-red-400">Failed to load edit plan</p>
          <p className="text-xs text-zinc-500">{(error as Error).message}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />Retry
            </Button>
            <Link href={`/project/${id}`}>
              <Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />Back to project</Button>
            </Link>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Production Review">
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {toastMessage && (
          <div className="absolute top-4 right-4 z-50 px-4 py-2 rounded-lg bg-red-500/90 text-white text-sm shadow-lg animate-in fade-in slide-in-from-top-2">
            {toastMessage}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="px-6 py-2 bg-yellow-500/10 border-b border-yellow-500/30 text-xs text-yellow-400 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              {needsReviewCount} segment{needsReviewCount !== 1 ? "s" : ""} need manual review — AI classification was incomplete.
              {" "}
              <button
                className="underline hover:text-yellow-300"
                onClick={() => { setFilter("needs_review"); setSelectedIdx(0); }}
              >
                Show them
              </button>
            </span>
          </div>
        )}

        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <Link href={`/project/${id}`}>
              <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
            </Link>
            <h1 className="text-lg font-semibold text-zinc-100">Production Review</h1>
            {stats && (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <span>{stats.reviewed}/{stats.total}</span>
                <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${stats.percentComplete}%` }} />
                </div>
                <span>{stats.percentComplete}%</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Filter buttons */}
            <div className="flex rounded-md border border-zinc-700 overflow-hidden">
              {(["all", "pending", "needs_review"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setSelectedIdx(0); }}
                  className={cn(
                    "px-2.5 py-1 text-[10px] transition-colors",
                    filter === f ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  {f === "all" ? `All (${allSegments.length})` : f === "pending" ? `Pending (${allSegments.filter(s => !s.userChoice).length})` : `Review (${needsReviewCount})`}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={bulkAcceptAI}>Accept All AI</Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Segment list */}
          <div className="w-80 border-r border-zinc-800 overflow-y-auto flex-shrink-0">
            {filteredSegments.length === 0 && (
              <div className="flex items-center justify-center h-32 text-xs text-zinc-500">
                No segments match this filter.
              </div>
            )}
            {filteredSegments.map((seg, idx) => {
              const isSelected = idx === selectedIdx;
              const isCut = seg.suggestion === "cut";
              const isNeedsReview = seg.suggestion === "review" || (seg.aiPath.action === "keep_original" && seg.confidence === 0);
              const choiceIcon = seg.userChoice === "ai" ? "🤖" : seg.userChoice === "original" ? "👤" : seg.userChoice === "custom" ? "✏️" : "";

              return (
                <div
                  key={seg.segmentId}
                  onClick={() => setSelectedIdx(idx)}
                  className={cn(
                    "px-4 py-3 cursor-pointer border-b border-zinc-800/50 transition-colors",
                    isSelected ? "bg-zinc-800" : "hover:bg-zinc-800/50",
                    isCut && "opacity-40",
                    isNeedsReview && !isSelected && "border-l-2 border-l-yellow-500/60",
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", ROLE_COLORS[seg.role] || "bg-zinc-700 text-zinc-300 border-zinc-600")}>
                        {seg.role}
                      </span>
                      {isNeedsReview && (
                        <AlertTriangle className="w-3 h-3 text-yellow-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {choiceIcon && <span className="text-xs">{choiceIcon}</span>}
                      {isCut && <Scissors className="w-3 h-3 text-red-400" />}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300 truncate">{seg.topic}</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    {seg.start !== null ? `${seg.start.toFixed(1)}s — ${seg.end?.toFixed(1)}s` : "image"}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <Button variant="ghost" size="sm" disabled={selectedIdx === 0} onClick={() => setSelectedIdx(selectedIdx - 1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" />Prev
                </Button>
                <span className="text-sm text-zinc-500">{selectedIdx + 1} / {filteredSegments.length}</span>
                <Button variant="ghost" size="sm" disabled={selectedIdx === filteredSegments.length - 1} onClick={() => setSelectedIdx(selectedIdx + 1)}>
                  Next<ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>

              {/* Segment header */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className={cn("text-xs px-2 py-1 rounded border", ROLE_COLORS[selected.role] || "bg-zinc-700 text-zinc-300 border-zinc-600")}>
                    {selected.role}
                  </span>
                  <span className="text-xs text-zinc-500">importance {selected.importance}/5</span>
                  <span className="text-xs text-zinc-500">{Math.round(selected.confidence * 100)}% confident</span>
                  {selected.aiPath.transitionAfter && (
                    <span className="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">{selected.aiPath.transitionAfter}</span>
                  )}
                </div>
                <h2 className="text-xl font-semibold text-zinc-100 mb-1">{selected.topic}</h2>
                <p className="text-sm text-zinc-400 leading-relaxed">{selected.text || "(no speech)"}</p>
                {selected.start !== null && (
                  <p className="text-xs text-zinc-600 mt-2">
                    {selected.start.toFixed(1)}s — {selected.end?.toFixed(1)}s
                    ({((selected.end || 0) - selected.start).toFixed(1)}s)
                    • {selected.mediaPath.split("/").pop()}
                  </p>
                )}
              </div>

              {/* Choice cards */}
              {selected.suggestion !== "cut" ? (
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    {/* AI */}
                    <div className={cn(
                      "p-4 rounded-lg border transition-all",
                      selected.userChoice === "ai" ? "border-blue-500 bg-blue-500/10" : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600",
                    )}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-blue-400">AI Director</span>
                        <span className="text-[10px] text-zinc-500 bg-zinc-700 px-2 py-0.5 rounded">{selected.aiPath.action.replace(/_/g, " ")}</span>
                      </div>
                      <MaterialPreview material={selected.aiPath.material} action={selected.aiPath.action} />
                      <p className="text-xs text-zinc-400 mb-2">{selected.aiPath.reason}</p>
                      {selected.aiPath.material && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <p className="text-[10px] text-zinc-600">{selected.aiPath.material.type.replace(/_/g, " ")} via {selected.aiPath.material.provider}</p>
                          {selected.aiPath.material.provider === "pexels" && (
                            <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Pexels</span>
                          )}
                          {selected.aiPath.material.type === "ai_image" && (
                            <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" />AI Generated
                            </span>
                          )}
                        </div>
                      )}
                      <Button
                        className="w-full mt-3" variant={selected.userChoice === "ai" ? "default" : "outline"} size="sm"
                        disabled={isPending} onClick={() => updateChoice(selected.segmentId, "ai")}
                      >
                        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : selected.userChoice === "ai" ? <><Check className="w-3 h-3 mr-1" />Accepted</> : "Accept AI"}
                      </Button>
                    </div>

                    {/* Original */}
                    <div className={cn(
                      "p-4 rounded-lg border transition-all",
                      selected.userChoice === "original" ? "border-green-500 bg-green-500/10" : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600",
                    )}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-green-400">Keep Original</span>
                        <span className="text-[10px] text-zinc-500 bg-zinc-700 px-2 py-0.5 rounded">as filmed</span>
                      </div>
                      <div className="w-full h-32 bg-zinc-900 rounded mb-3 flex items-center justify-center">
                        <Play className="w-8 h-8 text-zinc-700" />
                      </div>
                      <p className="text-xs text-zinc-400 mb-2">Keep the original footage as-is.</p>
                      <p className="text-[10px] text-zinc-600">{selected.mediaPath.split("/").pop()}</p>
                      <Button
                        className="w-full mt-3" variant={selected.userChoice === "original" ? "default" : "outline"} size="sm"
                        disabled={isPending} onClick={() => updateChoice(selected.segmentId, "original")}
                      >
                        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : selected.userChoice === "original" ? <><Check className="w-3 h-3 mr-1" />Chosen</> : "Keep Original"}
                      </Button>
                    </div>
                  </div>

                  {/* Custom choice */}
                  <div className={cn(
                    "p-4 rounded-lg border transition-all",
                    selected.userChoice === "custom" ? "border-amber-500 bg-amber-500/10" : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600",
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-amber-400 flex items-center gap-1.5">
                        <Pencil className="w-3.5 h-3.5" />Custom Edit
                      </span>
                    </div>
                    {showCustomInput === selected.segmentId ? (
                      <div className="space-y-2">
                        <textarea
                          className="w-full h-20 rounded bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-amber-500/50"
                          placeholder="Describe your custom edit instructions..."
                          value={customNotes}
                          onChange={e => setCustomNotes(e.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm" variant="default" disabled={!customNotes.trim() || isPending}
                            onClick={() => updateChoice(selected.segmentId, "custom", customNotes.trim())}
                          >
                            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Custom"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setShowCustomInput(null); setCustomNotes(""); }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : selected.userChoice === "custom" ? (
                      <div>
                        <p className="text-xs text-zinc-400 mb-2 italic">&ldquo;{selected.explanation}&rdquo;</p>
                        <Button size="sm" variant="outline" onClick={() => { setShowCustomInput(selected.segmentId); setCustomNotes(""); }}>
                          Edit Instructions
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-zinc-500">Neither option fits? Write your own edit instructions.</p>
                        <Button size="sm" variant="outline" onClick={() => { setShowCustomInput(selected.segmentId); setCustomNotes(""); }}>
                          Write Custom
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/5 mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Scissors className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium text-red-400">Suggested: Cut this segment</span>
                  </div>
                  <p className="text-xs text-zinc-400 mb-3">{selected.explanation}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => updateChoice(selected.segmentId, "ai")}>Confirm Cut</Button>
                    <Button variant="outline" size="sm" onClick={() => updateChoice(selected.segmentId, "original")}>Override: Keep</Button>
                  </div>
                </div>
              )}

              <div className="p-3 rounded bg-zinc-800/50 border border-zinc-700 mb-4">
                <p className="text-xs text-zinc-500 mb-1">AI Analysis</p>
                <p className="text-sm text-zinc-300">{selected.explanation}</p>
              </div>

              {/* Mark for review */}
              {selected.suggestion !== "review" && (
                <button
                  onClick={() => {
                    choiceMutation.mutate({ segId: selected.segmentId, choice: "custom", notes: "Flagged for review" });
                    setFilter("needs_review");
                  }}
                  className="flex items-center gap-1.5 text-[11px] text-yellow-500 hover:text-yellow-400 transition-colors"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Mark for review
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

// ─── Material preview ──────────────────────────────────────

function MaterialPreview({
  material,
  action,
}: {
  material: SegmentBlueprint["aiPath"]["material"];
  action: string;
}) {
  if (action === "keep_original") return null;

  if (material?.thumbnailUrl) {
    return (
      <img src={material.thumbnailUrl} alt={`${material.type} preview`}
        className="w-full h-32 object-cover rounded mb-3" />
    );
  }

  if (material?.url) {
    return (
      <a href={material.url} target="_blank" rel="noopener noreferrer"
        className="w-full h-32 bg-zinc-900 rounded mb-3 flex flex-col items-center justify-center gap-1 hover:bg-zinc-800 transition-colors"
      >
        <ImageIcon className="w-6 h-6 text-zinc-500" />
        <span className="text-[10px] text-zinc-500">Preview available</span>
      </a>
    );
  }

  // No material and no preview — don't show empty placeholder
  return null;
}
