"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Search,
  Check,
  Clock,
  Download,
  Loader2,
  RefreshCw,
  Film,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useStockSearch,
  useStockSuggestions,
  useSelectStock,
  useGenerateStockSuggestions,
  type StockResult,
  type StockSuggestion,
} from "@/hooks/use-stock-footage";

// ─── Provider Badge ──────────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  pexels: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  pixabay: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

function ProviderBadge({ provider }: { provider: string }) {
  return (
    <span
      className={cn(
        "rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        PROVIDER_COLORS[provider] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {provider}
    </span>
  );
}

// ─── Duration Badge ──────────────────────────────────────────────────────────

function DurationBadge({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const label = m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;

  return (
    <span className="flex items-center gap-0.5 rounded-sm bg-black/60 px-1.5 py-0.5 text-[10px] font-mono text-white backdrop-blur-sm">
      <Clock className="size-2.5" />
      {label}
    </span>
  );
}

// ─── Thumbnail Card ──────────────────────────────────────────────────────────

interface ThumbnailCardProps {
  result: StockResult;
  selected: boolean;
  onToggle: (id: string) => void;
}

function ThumbnailCard({ result, selected, onToggle }: ThumbnailCardProps) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Lazy loading with IntersectionObserver
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          img.src = result.thumbnailUrl;
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(img);
    return () => observer.disconnect();
  }, [result.thumbnailUrl]);

  return (
    <button
      type="button"
      onClick={() => onToggle(result.id)}
      className={cn(
        "group relative overflow-hidden rounded-lg border transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-border/80",
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full bg-muted">
        <img
          ref={imgRef}
          alt={result.description}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setLoaded(true)}
        />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Film className="size-6 text-muted-foreground/40" />
          </div>
        )}

        {/* Selected overlay */}
        {selected && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/20 backdrop-blur-[1px]">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary">
              <Check className="size-4 text-primary-foreground" />
            </div>
          </div>
        )}

        {/* Duration badge (top-right) */}
        {result.duration != null && (
          <div className="absolute right-1.5 top-1.5">
            <DurationBadge seconds={result.duration} />
          </div>
        )}

        {/* Provider badge (top-left) */}
        <div className="absolute left-1.5 top-1.5">
          <ProviderBadge provider={result.provider} />
        </div>

        {/* Resolution badge (bottom-right) */}
        <div className="absolute bottom-1.5 right-1.5 rounded-sm bg-black/60 px-1 py-0.5 text-[9px] font-mono text-white/70 backdrop-blur-sm">
          {result.width}x{result.height}
        </div>
      </div>

      {/* Description + Download */}
      <div className="p-2">
        <div className="flex items-center justify-between">
          <p className="line-clamp-1 text-left text-xs text-muted-foreground flex-1">
            {result.description}
          </p>
          <a
            href={result.downloadUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-1 shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Download"
          >
            <Download className="size-3.5" />
          </a>
        </div>
        {result.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {result.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-sm bg-muted px-1 py-0.5 text-[9px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Segment Suggestion Section ──────────────────────────────────────────────

interface SuggestionSectionProps {
  suggestion: StockSuggestion;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

function SuggestionSection({
  suggestion,
  selectedIds,
  onToggle,
}: SuggestionSectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-left transition-colors hover:bg-muted"
      >
        <div className="flex items-center gap-2">
          <ImageIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{suggestion.search_query}</span>
          <span className="text-xs text-muted-foreground">
            ({suggestion.results.length} results)
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {suggestion.asset_type.replace("_", " ")}
        </span>
      </button>

      {expanded && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {suggestion.results.map((result) => (
            <ThumbnailCard
              key={result.id}
              result={result}
              selected={selectedIds.has(result.id)}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Gallery ────────────────────────────────────────────────────────────

interface StockFootageGalleryProps {
  projectId: string;
  className?: string;
}

export function StockFootageGallery({
  projectId,
  className,
}: StockFootageGalleryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  const {
    data: suggestions,
    isLoading: suggestionsLoading,
  } = useStockSuggestions(projectId);

  const {
    data: searchResults,
    isLoading: searchLoading,
  } = useStockSearch(debouncedQuery);

  const selectMutation = useSelectStock(projectId);
  const generateMutation = useGenerateStockSuggestions(projectId);

  // Debounce search input
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, 400);
  }, []);

  // Toggle selection
  const handleToggle = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [],
  );

  // Save selections for a segment
  const handleSaveSelection = useCallback(
    (segmentId: string) => {
      selectMutation.mutate({
        segmentId,
        stockIds: Array.from(selectedIds),
      });
    },
    [selectMutation, selectedIds],
  );

  const hasSuggestions =
    suggestions?.suggestions && suggestions.suggestions.length > 0;
  const hasSearchResults =
    searchResults?.results && searchResults.results.length > 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Stock Footage</h3>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <span className="text-xs text-primary">
              {selectedIds.size} selected
            </span>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Refine search... (e.g., office meeting professional)"
          className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {searchLoading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Inline search results */}
      {hasSearchResults && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Search results for &ldquo;{debouncedQuery}&rdquo; ({searchResults.count})
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {searchResults.results.map((result) => (
              <ThumbnailCard
                key={result.id}
                result={result}
                selected={selectedIds.has(result.id)}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </div>
      )}

      {/* Suggestions by segment */}
      {suggestionsLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {hasSuggestions && (
        <div className="space-y-4">
          <div className="text-xs font-medium text-muted-foreground">
            Suggestions per content mark ({suggestions.suggestions.length} marks)
          </div>
          {suggestions.suggestions.map((suggestion) => (
            <SuggestionSection
              key={suggestion.segment_id}
              suggestion={suggestion}
              selectedIds={selectedIds}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {!suggestionsLoading && !hasSuggestions && !hasSearchResults && !searchQuery && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Film className="mb-3 size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No stock footage suggestions yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Click &ldquo;Generate Suggestions&rdquo; or search manually above.
          </p>
        </div>
      )}
    </div>
  );
}
