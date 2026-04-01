// ─── Content Mark Router ────────────────────────────────────────────────────
// Maps MK-12 content mark types to Remotion template compositions.

import type { InfoGraphicProps } from "../templates/InfoGraphic";
import type { TextOverlayProps } from "../templates/TextOverlay";
import type { StockFootagePlaceholderProps } from "../templates/StockFootagePlaceholder";
import type { ArticleReferenceProps } from "../templates/ArticleReference";
import type { ConceptExplainerProps } from "../templates/ConceptExplainer";
import type { ChapterTitleProps } from "../templates/ChapterTitle";
import type { KnowledgeGraphAnimProps } from "../templates/KnowledgeGraphAnim";
import type { DataDashboardProps } from "../templates/DataDashboard";
import type { ProcessFlowProps } from "../templates/ProcessFlow";

// ─── Content Mark Types ─────────────────────────────────────────────────────
// These match the MK-12 spec asset_type values on segments.

export type AssetType =
  | "animation"
  | "stock_video"
  | "article"
  | "ai_image"
  | "loom_recording"
  | "speaking_only";

export type SpecialMark = "chapter_boundary";

export type MarkType = AssetType | SpecialMark;

/** Inbound content mark from the MK-12 pipeline */
export interface ContentMark {
  id?: string;
  asset_type: MarkType;
  search_query: string;
  segment_id?: string;
  /** For chapter boundaries */
  chapter_number?: number;
  chapter_title?: string;
  chapter_duration?: string;
  total_chapters?: number;
  /** Speaker info for lower thirds */
  speaker_name?: string;
  speaker_role?: string;
}

// ─── Template Composition IDs ───────────────────────────────────────────────
// Must match the Composition ids registered in Root.tsx

export type CompositionId =
  | "InfoGraphic"
  | "TextOverlay"
  | "StockFootagePlaceholder"
  | "ArticleReference"
  | "ConceptExplainer"
  | "ChapterTitle"
  | "KnowledgeGraphAnim"
  | "DataDashboard"
  | "ProcessFlow";

export type TemplateProps =
  | InfoGraphicProps
  | TextOverlayProps
  | StockFootagePlaceholderProps
  | ArticleReferenceProps
  | ConceptExplainerProps
  | ChapterTitleProps
  | KnowledgeGraphAnimProps
  | DataDashboardProps
  | ProcessFlowProps;

export interface RoutingResult {
  compositionId: CompositionId;
  /** Default duration in frames (can be overridden) */
  defaultDurationFrames: number;
  /** Whether the prompt needs LLM conversion to props */
  needsLlmConversion: boolean;
  /** For types that can resolve without LLM, a fallback props generator */
  fallbackProps?: (mark: ContentMark) => TemplateProps;
}

// ─── Router ─────────────────────────────────────────────────────────────────

const ROUTE_MAP: Record<MarkType, RoutingResult> = {
  animation: {
    compositionId: "InfoGraphic",
    defaultDurationFrames: 210, // 7s
    needsLlmConversion: true,
  },
  stock_video: {
    compositionId: "StockFootagePlaceholder",
    defaultDurationFrames: 150, // 5s
    needsLlmConversion: false,
    fallbackProps: (mark): StockFootagePlaceholderProps => ({
      searchQuery: mark.search_query,
      scenario: extractScenario(mark.search_query),
    }),
  },
  article: {
    compositionId: "ArticleReference",
    defaultDurationFrames: 180, // 6s
    needsLlmConversion: true,
  },
  ai_image: {
    compositionId: "ConceptExplainer",
    defaultDurationFrames: 180, // 6s
    needsLlmConversion: true,
  },
  loom_recording: {
    compositionId: "StockFootagePlaceholder",
    defaultDurationFrames: 120, // 4s
    needsLlmConversion: false,
    fallbackProps: (mark): StockFootagePlaceholderProps => ({
      searchQuery: mark.search_query,
      description: "Screen recording placeholder",
      sources: ["Loom"],
    }),
  },
  speaking_only: {
    compositionId: "TextOverlay",
    defaultDurationFrames: 120, // 4s
    needsLlmConversion: false,
    fallbackProps: (mark): TextOverlayProps => ({
      text: mark.speaker_name || "Speaker",
      secondaryText: mark.speaker_role || "",
      variant: "lower_third",
    }),
  },
  chapter_boundary: {
    compositionId: "ChapterTitle",
    defaultDurationFrames: 120, // 4s
    needsLlmConversion: false,
    fallbackProps: (mark): ChapterTitleProps => ({
      chapterNumber: mark.chapter_number ?? 1,
      title: mark.chapter_title || mark.search_query || "Chapter",
      duration: mark.chapter_duration,
      totalChapters: mark.total_chapters,
    }),
  },
};

/**
 * Route a content mark to its template composition and determine
 * whether LLM processing is needed.
 */
export function routeContentMark(mark: ContentMark): RoutingResult {
  const route = ROUTE_MAP[mark.asset_type];
  if (!route) {
    // Default to ConceptExplainer for unknown types
    return {
      compositionId: "ConceptExplainer",
      defaultDurationFrames: 180,
      needsLlmConversion: true,
    };
  }
  return route;
}

/**
 * For marks that have a more specific sub-type, potentially re-route.
 * E.g., animation marks with "workflow" or "process" in the query
 * go to InfoGraphic with flow layout; others go to ConceptExplainer.
 */
export function routeAnimationMark(searchQuery: string): CompositionId {
  const lower = searchQuery.toLowerCase();
  const workflowKeywords = ["workflow", "process", "pipeline", "flow", "steps", "funnel", "cycle"];
  const dataKeywords = ["data", "chart", "statistics", "percentage", "comparison", "metrics", "analytics", "dashboard"];
  const graphKeywords = ["knowledge", "graph", "network", "concept map", "relationship", "ontology", "taxonomy"];

  if (graphKeywords.some((kw) => lower.includes(kw))) {
    return "KnowledgeGraphAnim";
  }
  if (workflowKeywords.some((kw) => lower.includes(kw))) {
    return "ProcessFlow";
  }
  if (dataKeywords.some((kw) => lower.includes(kw))) {
    return "DataDashboard";
  }
  return "ConceptExplainer";
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract scenario portion from search query (text before the arrow) */
function extractScenario(query: string): string | undefined {
  const parts = query.split(/[→\->]/);
  if (parts.length > 1) {
    return parts[0].replace(/^scenario:\s*/i, "").trim();
  }
  return undefined;
}
