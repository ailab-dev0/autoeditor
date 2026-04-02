"use client";

import { use, useState, useMemo, useEffect } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { TranscriptViewer } from "@/components/transcript/TranscriptViewer";
import { useTranscript, transcriptKeys } from "@/hooks/use-transcript";
import { useVideoSync } from "@/hooks/use-video-sync";
import { useWebSocketSubscribe } from "@/hooks/use-websocket";
import { apiClient } from "@/lib/api-client";

export default function TranscriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const queryClient = useQueryClient();
  const { data: transcript, isLoading } = useTranscript(projectId);
  const videoSync = useVideoSync();
  const { subscribe } = useWebSocketSubscribe();
  const [searchQuery, setSearchQuery] = useState("");

  // Get approved segment IDs from blueprint
  const { data: blueprintData } = useQuery({
    queryKey: ["blueprint", projectId],
    queryFn: () => apiClient.blueprint.get(projectId),
    enabled: !!projectId,
  });
  const approvedSegmentIds = useMemo(() => {
    const segs = blueprintData?.blueprint?.segments ?? [];
    return new Set(
      segs.filter(s => s.userChoice === "ai" || s.userChoice === "original" || s.userChoice === "custom")
        .map(s => s.segmentId)
    );
  }, [blueprintData]);

  // Re-fetch transcript when backend pushes an update via WebSocket
  useEffect(() => {
    if (!projectId) return;
    const unsub = subscribe("transcript_updated", () => {
      queryClient.invalidateQueries({ queryKey: transcriptKeys.all(projectId) });
    });
    return unsub;
  }, [projectId, subscribe, queryClient]);

  // Filter: only approved segments, then apply search
  const filteredSegments = useMemo(() => {
    let segs = transcript?.segments ?? [];

    // Only show segments that have been approved in the Review section
    if (approvedSegmentIds.size > 0) {
      segs = segs.filter(seg => approvedSegmentIds.has(seg.id));
    }

    if (!searchQuery.trim()) return segs;
    const q = searchQuery.toLowerCase();
    return segs.filter(seg =>
      seg.text.toLowerCase().includes(q) ||
      (seg.speaker && seg.speaker.toLowerCase().includes(q))
    );
  }, [transcript?.segments, searchQuery, approvedSegmentIds]);

  if (isLoading) {
    return (
      <PageLayout title="Transcript">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Transcript"
      description={
        transcript
          ? `Version ${transcript.version} -- ${transcript.language ?? "unknown"} -- ${transcript.segments?.length ?? 0} segments`
          : "No transcript available"
      }
      actions={
        <Button variant="outline" size="sm" disabled={!transcript}>
          <Download className="size-4" />
          Export SRT
        </Button>
      }
      fullHeight
    >
      {transcript?.segments ? (
        <div className="flex flex-col h-full">
          {/* Search bar */}
          <div className="shrink-0 px-4 py-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search transcript..."
                className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {filteredSegments.length} match{filteredSegments.length !== 1 ? "es" : ""}
                </span>
              )}
            </div>
          </div>

          {/* Transcript content */}
          <TranscriptViewer
            segments={filteredSegments}
            currentTime={videoSync.currentTime}
            onSeek={videoSync.seekTo}
            searchQuery={searchQuery}
            reviewLinkProjectId={projectId}
            className="flex-1 min-h-0"
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          No transcript yet. Run the pipeline to generate one.
        </div>
      )}
    </PageLayout>
  );
}
