"use client";

import {
  Lightbulb,
  BookOpen,
  Zap,
  ArrowRightLeft,
  ListChecks,
  Megaphone,
  Image,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContentMark, ContentMarkType } from "@/lib/types";

interface ContentMarkCardProps {
  mark: ContentMark;
  onEdit?: (mark: ContentMark) => void;
  className?: string;
}

const MARK_TYPE_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  key_concept: { icon: Lightbulb, color: "text-yellow-400", label: "Key Concept" },
  definition: { icon: BookOpen, color: "text-blue-400", label: "Definition" },
  example: { icon: Zap, color: "text-green-400", label: "Example" },
  transition: { icon: ArrowRightLeft, color: "text-purple-400", label: "Transition" },
  summary: { icon: ListChecks, color: "text-cyan-400", label: "Summary" },
  callout: { icon: Megaphone, color: "text-orange-400", label: "Callout" },
  visual_aid: { icon: Image, color: "text-pink-400", label: "Visual Aid" },
  // Backend content mark types
  stock_video: { icon: Image, color: "text-cyan-400", label: "Stock Video" },
  animation: { icon: Zap, color: "text-lime-400", label: "Animation" },
  article: { icon: BookOpen, color: "text-pink-400", label: "Article" },
  ai_image: { icon: Image, color: "text-pink-400", label: "AI Image" },
  linkedin_photo: { icon: Image, color: "text-white", label: "LinkedIn Photo" },
  loom_recording: { icon: Megaphone, color: "text-teal-400", label: "Loom Recording" },
  speaking_only: { icon: Megaphone, color: "text-gray-400", label: "Speaking Only" },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const FALLBACK_CONFIG = { icon: Lightbulb, color: "text-gray-400", label: "Mark" };

export function ContentMarkCard({ mark, onEdit, className }: ContentMarkCardProps) {
  const config = MARK_TYPE_CONFIG[mark.type] ?? FALLBACK_CONFIG;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3 transition-colors",
        onEdit && "cursor-pointer hover:border-border/80 hover:bg-accent/30",
        !mark.approved && "opacity-60",
        className,
      )}
      onClick={() => onEdit?.(mark)}
      role={onEdit ? "button" : undefined}
      tabIndex={onEdit ? 0 : undefined}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md bg-muted",
            config.color,
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{mark.label}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {config.label}
            </span>
          </div>
          {mark.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {mark.description}
            </p>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground-dim">
              {formatTime(mark.timestamp)}
              {mark.duration != null && ` (${mark.duration.toFixed(1)}s)`}
            </span>
            {mark.approved && (
              <span className="text-[10px] text-green-400 font-medium">Approved</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
