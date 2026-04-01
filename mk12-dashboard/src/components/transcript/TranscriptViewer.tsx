"use client";

import { useRef, useEffect, Fragment } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranscriptSegment } from "@/lib/types";

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  currentTime?: number;
  onSeek?: (time: number) => void;
  highlightSegmentId?: string;
  searchQuery?: string;
  reviewLinkProjectId?: string;
  className?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-400/30 text-yellow-200 rounded px-0.5">{part}</mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

export function TranscriptViewer({
  segments,
  currentTime = 0,
  onSeek,
  highlightSegmentId,
  searchQuery = "",
  reviewLinkProjectId,
  className,
}: TranscriptViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  const activeSegmentIndex = segments.findIndex(
    (seg) => currentTime >= seg.startTime && currentTime < seg.endTime,
  );

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeSegmentIndex]);

  return (
    <div
      ref={containerRef}
      className={cn("overflow-y-auto space-y-1 p-4", className)}
    >
      {segments.map((segment, index) => {
        const isActive = index === activeSegmentIndex;
        const isHighlighted = segment.id === highlightSegmentId;

        return (
          <div
            key={segment.id}
            ref={isActive ? activeRef : undefined}
            className={cn(
              "group flex gap-3 rounded-md px-3 py-2 transition-colors cursor-pointer",
              isActive && "bg-primary/10 border-l-2 border-l-primary",
              isHighlighted && !isActive && "bg-accent",
              !isActive && !isHighlighted && "hover:bg-accent/40",
            )}
            onClick={() => onSeek?.(segment.startTime)}
          >
            {/* Timestamp */}
            <span className="shrink-0 pt-0.5 text-xs font-mono text-muted-foreground tabular-nums">
              {formatTime(segment.startTime)}
            </span>

            {/* Speaker badge */}
            {segment.speaker && (
              <span className="shrink-0 pt-0.5 text-xs font-semibold text-muted-foreground uppercase">
                {segment.speaker}
              </span>
            )}

            {/* Text with word-level or search highlighting */}
            <p className="flex-1 text-sm leading-relaxed text-foreground/90">
              {segment.words.length > 0 && !searchQuery
                ? segment.words.map((word, wi) => {
                    const isWordActive =
                      currentTime >= word.startTime && currentTime < word.endTime;
                    return (
                      <span
                        key={wi}
                        className={cn(
                          "transition-colors",
                          isWordActive && "bg-primary/30 text-foreground rounded px-0.5",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSeek?.(word.startTime);
                        }}
                      >
                        {word.text}{" "}
                      </span>
                    );
                  })
                : searchQuery
                  ? <HighlightedText text={segment.text} query={searchQuery} />
                  : segment.text
              }
            </p>

            {/* Link to review page */}
            {reviewLinkProjectId && (
              <Link
                href={`/project/${reviewLinkProjectId}/review#${segment.id}`}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pt-0.5"
                onClick={e => e.stopPropagation()}
                title="View in review"
              >
                <ExternalLink className="size-3.5 text-muted-foreground hover:text-foreground" />
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
