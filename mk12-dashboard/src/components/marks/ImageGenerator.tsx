"use client";

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  Download,
  ChevronDown,
  ImageIcon,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useGenerateImage,
  useGenerateForSegment,
  useProjectImages,
  type ImageModel,
  type AspectRatio,
  type GeneratedImage,
} from "@/hooks/use-image-generation";

// ─── Props ───────────────────────────────────────────────────────────────────

interface ImageGeneratorProps {
  projectId: string;
  /** If provided, generates from this segment's content mark */
  segmentId?: string;
  /** Pre-filled prompt (e.g. from content mark search_query) */
  defaultPrompt?: string;
  className?: string;
}

// ─── Model options ───────────────────────────────────────────────────────────

const MODEL_OPTIONS: { value: ImageModel; label: string; description: string }[] = [
  { value: "flux", label: "Nano Banana Pro", description: "Fast, high quality" },
];

const ASPECT_OPTIONS: { value: AspectRatio; label: string }[] = [
  { value: "16:9", label: "16:9 (Widescreen)" },
  { value: "4:3", label: "4:3 (Standard)" },
  { value: "1:1", label: "1:1 (Square)" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function ImageGenerator({
  projectId,
  segmentId,
  defaultPrompt,
  className,
}: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState(defaultPrompt ?? "");
  const [model, setModel] = useState<ImageModel>("flux");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [showOptions, setShowOptions] = useState(false);

  const generateImage = useGenerateImage(projectId);
  const generateForSegment = useGenerateForSegment(projectId);
  const { data: imagesData } = useProjectImages(projectId);

  const isGenerating = generateImage.isPending || generateForSegment.isPending;
  const error = generateImage.error ?? generateForSegment.error;
  const lastGenerated = generateImage.data?.image ?? generateForSegment.data?.image;

  // Filter images for this segment if segmentId is provided
  const segmentImages = segmentId
    ? (imagesData?.images ?? []).filter((img) => img.segment_id === segmentId)
    : [];

  function handleGenerate() {
    if (segmentId) {
      generateForSegment.mutate({ segmentId, model, aspectRatio });
    } else if (prompt.trim()) {
      generateImage.mutate({ prompt: prompt.trim(), model, aspectRatio });
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Prompt input (only shown when no segmentId) */}
      {!segmentId && (
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image to generate..."
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isGenerating) handleGenerate();
            }}
            disabled={isGenerating}
          />
        </div>
      )}

      {/* Generate button + options toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || (!segmentId && !prompt.trim())}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            "bg-violet-600 text-white hover:bg-violet-700",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" />
              Generate Image
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowOptions(!showOptions)}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Options
          <ChevronDown className={cn("size-3 transition-transform", showOptions && "rotate-180")} />
        </button>
      </div>

      {/* Options panel */}
      {showOptions && (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Model</label>
            <div className="flex gap-2">
              {MODEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setModel(opt.value)}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                    model === opt.value
                      ? "border-violet-500 bg-violet-500/10 text-violet-400"
                      : "border-border text-muted-foreground hover:border-border/80",
                  )}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-[10px] opacity-70">{opt.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Aspect Ratio
            </label>
            <div className="flex gap-2">
              {ASPECT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAspectRatio(opt.value)}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                    aspectRatio === opt.value
                      ? "border-violet-500 bg-violet-500/10 text-violet-400"
                      : "border-border text-muted-foreground hover:border-border/80",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3">
          <AlertCircle className="size-4 shrink-0 text-red-400 mt-0.5" />
          <p className="text-xs text-red-400">{(error as Error).message}</p>
        </div>
      )}

      {/* Last generated image */}
      {lastGenerated && (
        <GeneratedImageCard image={lastGenerated} isNew />
      )}

      {/* Previously generated images for this segment */}
      {segmentImages.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">
            Previous Generations ({segmentImages.length})
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {segmentImages.map((img) => (
              <GeneratedImageCard key={img.id} image={img} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Image Card Sub-component ────────────────────────────────────────────────

function GeneratedImageCard({
  image,
  isNew,
  compact,
}: {
  image: GeneratedImage;
  isNew?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card overflow-hidden",
        isNew && "ring-1 ring-violet-500/50",
      )}
    >
      <div className={cn("relative", compact ? "aspect-video" : "aspect-video max-h-64")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.imageUrl}
          alt={image.prompt}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {isNew && (
          <span className="absolute top-2 left-2 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-medium text-white">
            New
          </span>
        )}
      </div>
      <div className={cn("p-2 space-y-1", compact && "p-1.5")}>
        <p className={cn("text-muted-foreground line-clamp-2", compact ? "text-[10px]" : "text-xs")}>
          {image.prompt}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {image.model} / {image.width}x{image.height}
          </span>
          <a
            href={image.imageUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
          >
            <Download className="size-3" />
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Gallery Sub-component (for project-wide view) ───────────────────────────

export function ImageGallery({ projectId }: { projectId: string }) {
  const { data, isLoading } = useProjectImages(projectId);
  const images = data?.images ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ImageIcon className="size-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          No generated images yet. Use the Generate button on content marks to create AI images.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{images.length} Generated Images</h3>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((img) => (
          <GeneratedImageCard key={img.id} image={img} />
        ))}
      </div>
    </div>
  );
}
