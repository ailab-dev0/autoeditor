"use client";

import {
  Loader2,
  BookOpen,
  Lightbulb,
  Link2,
  GraduationCap,
  Eye,
  Search,
  ExternalLink,
  Sparkles,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useResearch,
  useResearchConcept,
  useBulkResearch,
  type ResearchResult,
  type ResearchSource,
} from "@/hooks/use-research";

// ─── Props ───────────────────────────────────────────────────────────────────

interface ResearchPanelProps {
  projectId: string;
  conceptId?: string;
  conceptLabel?: string;
  className?: string;
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function ResearchPanel({
  projectId,
  conceptId,
  conceptLabel,
  className,
}: ResearchPanelProps) {
  // Use concept label as the consistent key for both reading and writing research
  const researchKey = conceptLabel || conceptId;

  const {
    data: research,
    isLoading,
    error: fetchError,
  } = useResearch(projectId, researchKey);

  const researchMutation = useResearchConcept(projectId);
  const bulkMutation = useBulkResearch(projectId);

  const isResearching = researchMutation.isPending;
  const mutationError = researchMutation.error ?? bulkMutation.error;

  function handleResearch() {
    if (researchKey) {
      researchMutation.mutate(researchKey);
    }
  }

  function handleBulkResearch() {
    bulkMutation.mutate();
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="shrink-0 border-b border-border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-blue-400" />
          <h3 className="text-sm font-semibold">Deep Research</h3>
        </div>

        {conceptId && conceptLabel && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Concept:</span>
            <span className="text-xs font-medium">{conceptLabel}</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {conceptId && (
            <button
              type="button"
              onClick={handleResearch}
              disabled={isResearching || isLoading}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                "bg-blue-600 text-white hover:bg-blue-700",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              {isResearching ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Researching...
                </>
              ) : research ? (
                <>
                  <Search className="size-3" />
                  Re-Research
                </>
              ) : (
                <>
                  <Sparkles className="size-3" />
                  Research
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleBulkResearch}
            disabled={bulkMutation.isPending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium transition-colors",
              "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {bulkMutation.isPending ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                Researching All...
              </>
            ) : (
              <>
                <BookOpen className="size-3" />
                Research All
              </>
            )}
          </button>
        </div>

        {/* Bulk research result count */}
        {bulkMutation.isSuccess && (
          <p className="text-[10px] text-green-400">
            Completed research on {bulkMutation.data.count} concepts
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Error display */}
        {mutationError && (
          <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2.5">
            <AlertCircle className="size-3.5 shrink-0 text-red-400 mt-0.5" />
            <p className="text-[11px] text-red-400">{(mutationError as Error).message}</p>
          </div>
        )}

        {/* Loading state */}
        {(isLoading || isResearching) && !research && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {isResearching ? "Generating research brief..." : "Loading research..."}
            </p>
          </div>
        )}

        {/* No concept selected */}
        {!conceptId && !isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className="size-6 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              Select a concept from the knowledge graph to research it
            </p>
          </div>
        )}

        {/* No research yet for selected concept */}
        {conceptId && !research && !isLoading && !isResearching && !fetchError && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="size-6 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              No research yet for this concept.
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Click "Research" to generate a brief.
            </p>
          </div>
        )}

        {/* Research results */}
        {research && <ResearchContent research={research} />}
      </div>
    </div>
  );
}

// ─── Research Content Display ────────────────────────────────────────────────

function ResearchContent({ research }: { research: ResearchResult }) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <ResearchSection
        icon={BookOpen}
        title="Summary"
        iconColor="text-blue-400"
      >
        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
          {research.summary}
        </p>
      </ResearchSection>

      {/* Key Facts */}
      {research.keyFacts.length > 0 && (
        <ResearchSection
          icon={Lightbulb}
          title={`Key Facts (${research.keyFacts.length})`}
          iconColor="text-yellow-400"
        >
          <ul className="space-y-1.5">
            {research.keyFacts.map((fact, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="shrink-0 mt-1 size-1.5 rounded-full bg-yellow-400/60" />
                {fact}
              </li>
            ))}
          </ul>
        </ResearchSection>
      )}

      {/* Sources */}
      {research.sources.length > 0 && (
        <ResearchSection
          icon={Link2}
          title={`Sources (${research.sources.length})`}
          iconColor="text-green-400"
        >
          <ul className="space-y-2">
            {research.sources.map((source, i) => (
              <SourceItem key={i} source={source} />
            ))}
          </ul>
        </ResearchSection>
      )}

      {/* Teaching Notes */}
      {research.teachingNotes && (
        <ResearchSection
          icon={GraduationCap}
          title="Teaching Notes"
          iconColor="text-purple-400"
        >
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
            {research.teachingNotes}
          </p>
        </ResearchSection>
      )}

      {/* Visual Suggestions */}
      {research.visualSuggestions.length > 0 && (
        <ResearchSection
          icon={Eye}
          title={`Visual Suggestions (${research.visualSuggestions.length})`}
          iconColor="text-pink-400"
        >
          <ul className="space-y-1.5">
            {research.visualSuggestions.map((suggestion, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="shrink-0 mt-1 size-1.5 rounded-full bg-pink-400/60" />
                {suggestion}
              </li>
            ))}
          </ul>
        </ResearchSection>
      )}

      {/* Timestamp */}
      <div className="pt-2 border-t border-border">
        <p className="text-[10px] text-muted-foreground">
          Researched: {new Date(research.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function ResearchSection({
  icon: Icon,
  title,
  iconColor,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("size-3.5", iconColor)} />
        <h4 className="text-xs font-semibold">{title}</h4>
      </div>
      {children}
    </div>
  );
}

// ─── Source item ──────────────────────────────────────────────────────────────

function SourceItem({ source }: { source: ResearchSource }) {
  const typeColors: Record<string, string> = {
    article: "text-blue-400 bg-blue-400/10",
    paper: "text-green-400 bg-green-400/10",
    report: "text-orange-400 bg-orange-400/10",
  };

  return (
    <li className="flex items-start gap-2">
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize",
          typeColors[source.type] ?? "text-muted-foreground bg-muted",
        )}
      >
        {source.type}
      </span>
      <div className="min-w-0 flex-1">
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <span className="truncate">{source.title}</span>
            <ExternalLink className="size-3 shrink-0" />
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">{source.title}</span>
        )}
      </div>
    </li>
  );
}
