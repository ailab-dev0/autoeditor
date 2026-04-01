"use client";

/**
 * AnnotationOverlay — renders annotation markers on the segment timeline.
 *
 * Shows colored markers for each annotation, positioned by timestamp.
 * Click to view/edit. Includes an inline text editor for new annotations.
 * Color-coded by author using the collaboration color assignments.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Annotation } from "@/hooks/use-collaboration";

interface AnnotationOverlayProps {
  annotations: Annotation[];
  /** Total timeline duration in seconds */
  duration: number;
  /** Current playback time in seconds */
  currentTime: number;
  /** The currently active segment ID (for creating annotations) */
  activeSegmentId: string | null;
  /** User identity for creating annotations */
  userId: string;
  userName: string;
  userColor: string;
  /** CRUD callbacks */
  onCreate: (input: {
    text: string;
    timestamp: number;
    segment_id: string;
    author_id: string;
    author_name: string;
    color?: string;
  }) => Promise<Annotation | null>;
  onUpdate: (
    annotationId: string,
    input: { text?: string; timestamp?: number },
  ) => Promise<Annotation | null>;
  onDelete: (annotationId: string) => Promise<boolean>;
  className?: string;
}

interface AnnotationMarkerProps {
  annotation: Annotation;
  position: number; // 0-100 percentage
  isSelected: boolean;
  onSelect: () => void;
}

function AnnotationMarker({
  annotation,
  position,
  isSelected,
  onSelect,
}: AnnotationMarkerProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "absolute top-0 -translate-x-1/2 flex flex-col items-center cursor-pointer group transition-all z-10",
        isSelected && "z-20",
      )}
      style={{ left: `${position}%` }}
      title={`${annotation.author_name}: ${annotation.text}`}
    >
      {/* Marker pin */}
      <div
        className={cn(
          "size-4 rounded-full border-2 border-background shadow-sm transition-transform",
          isSelected && "scale-125 ring-2 ring-white/30",
          "group-hover:scale-110",
        )}
        style={{ backgroundColor: annotation.color }}
      />

      {/* Vertical line */}
      <div
        className="w-px h-3 opacity-50"
        style={{ backgroundColor: annotation.color }}
      />

      {/* Hover preview */}
      <div className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 rounded-md bg-popover border border-border px-2 py-1 text-[10px] text-popover-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap max-w-[200px] truncate z-50">
        <span className="font-medium" style={{ color: annotation.color }}>
          {annotation.author_name}:
        </span>{" "}
        {annotation.text}
      </div>
    </button>
  );
}

export function AnnotationOverlay({
  annotations,
  duration,
  currentTime,
  activeSegmentId,
  userId,
  userName,
  userColor,
  onCreate,
  onUpdate,
  onDelete,
  className,
}: AnnotationOverlayProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedAnnotation = useMemo(
    () => annotations.find((a) => a.id === selectedId) ?? null,
    [annotations, selectedId],
  );

  // Focus input when creating or editing
  useEffect(() => {
    if ((isCreating || isEditing) && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating, isEditing]);

  const handleStartCreate = useCallback(() => {
    setIsCreating(true);
    setIsEditing(false);
    setSelectedId(null);
    setInputText("");
  }, []);

  const handleStartEdit = useCallback(() => {
    if (!selectedAnnotation) return;
    setIsEditing(true);
    setIsCreating(false);
    setInputText(selectedAnnotation.text);
  }, [selectedAnnotation]);

  const handleSubmitCreate = useCallback(async () => {
    if (!inputText.trim() || !activeSegmentId) return;
    await onCreate({
      text: inputText.trim(),
      timestamp: currentTime,
      segment_id: activeSegmentId,
      author_id: userId,
      author_name: userName,
      color: userColor,
    });
    setInputText("");
    setIsCreating(false);
  }, [inputText, currentTime, activeSegmentId, userId, userName, userColor, onCreate]);

  const handleSubmitEdit = useCallback(async () => {
    if (!selectedId || !inputText.trim()) return;
    await onUpdate(selectedId, { text: inputText.trim() });
    setInputText("");
    setIsEditing(false);
  }, [selectedId, inputText, onUpdate]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    const success = await onDelete(selectedId);
    if (success) {
      setSelectedId(null);
      setIsEditing(false);
    }
  }, [selectedId, onDelete]);

  const handleCancel = useCallback(() => {
    setIsCreating(false);
    setIsEditing(false);
    setInputText("");
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        if (isCreating) handleSubmitCreate();
        else if (isEditing) handleSubmitEdit();
      }
      if (e.key === "Escape") {
        handleCancel();
      }
    },
    [isCreating, isEditing, handleSubmitCreate, handleSubmitEdit, handleCancel],
  );

  const safeDuration = Math.max(duration, 1);

  return (
    <div className={cn("relative", className)}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-dim bg-accent/10">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="size-3.5" />
          <span className="font-medium">
            Annotations
          </span>
          <span className="tabular-nums">({annotations.length})</span>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleStartCreate}
          disabled={!activeSegmentId || isCreating}
          className="h-6 text-[10px]"
        >
          <Plus className="size-3 mr-0.5" />
          Add
        </Button>
      </div>

      {/* Timeline track with annotation markers */}
      <div className="relative h-8 mx-3 my-2">
        {/* Background track */}
        <div className="absolute inset-x-0 top-2 h-1 rounded-full bg-muted" />

        {/* Current time indicator */}
        <div
          className="absolute top-0.5 w-0.5 h-5 bg-white/60 rounded-full transition-all"
          style={{ left: `${(currentTime / safeDuration) * 100}%` }}
        />

        {/* Annotation markers */}
        {annotations.map((annotation) => (
          <AnnotationMarker
            key={annotation.id}
            annotation={annotation}
            position={(annotation.timestamp / safeDuration) * 100}
            isSelected={selectedId === annotation.id}
            onSelect={() => {
              setSelectedId((prev) => (prev === annotation.id ? null : annotation.id));
              setIsEditing(false);
              setIsCreating(false);
            }}
          />
        ))}
      </div>

      {/* Selected annotation detail */}
      {selectedAnnotation && !isEditing && (
        <div className="mx-3 mb-2 rounded-md border border-border bg-card p-2">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <div
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: selectedAnnotation.color }}
                />
                <span className="text-xs font-medium" style={{ color: selectedAnnotation.color }}>
                  {selectedAnnotation.author_name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  at {formatTime(selectedAnnotation.timestamp)}
                </span>
              </div>
              <p className="text-xs text-foreground leading-relaxed">
                {selectedAnnotation.text}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0.5 ml-2 shrink-0">
              {selectedAnnotation.author_id === userId && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleStartEdit}
                    className="h-6 w-6 p-0"
                  >
                    <Pencil className="size-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDelete}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inline editor (create or edit) */}
      {(isCreating || isEditing) && (
        <div className="mx-3 mb-2 rounded-md border border-primary/30 bg-card p-2">
          <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-muted-foreground">
            {isCreating ? (
              <>
                <Plus className="size-3" />
                New annotation at {formatTime(currentTime)}
              </>
            ) : (
              <>
                <Pencil className="size-3" />
                Editing annotation
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your annotation..."
              className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={isCreating ? handleSubmitCreate : handleSubmitEdit}
              disabled={!inputText.trim()}
              className="h-6 w-6 p-0 text-green-400"
            >
              <Check className="size-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              className="h-6 w-6 p-0"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
