// ─── Prompt to Props ────────────────────────────────────────────────────────
// Uses LLM (OpenAI-compatible) to convert content mark search_query strings
// into structured props for Remotion templates.

import OpenAI from "openai";
import { z } from "zod";
import {
  type ContentMark,
  type CompositionId,
  routeContentMark,
  routeAnimationMark,
} from "./content-mark-router";
import type { InfoGraphicProps, InfoGraphicStep } from "../templates/InfoGraphic";
import type { TextOverlayProps } from "../templates/TextOverlay";
import type { ArticleReferenceProps } from "../templates/ArticleReference";
import type { ConceptExplainerProps, ConceptPoint } from "../templates/ConceptExplainer";
import type { ChapterTitleProps } from "../templates/ChapterTitle";
import type { StockFootagePlaceholderProps } from "../templates/StockFootagePlaceholder";

// ─── LLM Client ─────────────────────────────────────────────────────────────

function getClient(): OpenAI {
  const baseURL = process.env.OPENROUTER_BASE_URL || process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "No API key found. Set OPENAI_API_KEY or OPENROUTER_API_KEY environment variable.",
    );
  }

  return new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
}

function getModel(): string {
  return (
    process.env.LLM_MODEL ||
    process.env.OPENROUTER_MODEL ||
    "gpt-4o-mini"
  );
}

// ─── Schema definitions for each template ───────────────────────────────────

const InfoGraphicStepSchema = z.object({
  label: z.string().describe("Short label for this step (2-4 words)"),
  value: z.number().optional().describe("Percentage value 0-100, if applicable"),
  description: z.string().optional().describe("One sentence description"),
  icon: z
    .enum([
      "currency", "chart", "document", "workflow", "person", "group",
      "chat", "code", "cloud", "lightbulb", "checkmark", "arrow",
      "star", "clock",
    ])
    .optional()
    .describe("Icon key"),
});

const InfoGraphicSchema = z.object({
  title: z.string().describe("Clear, concise title (3-6 words)"),
  subtitle: z.string().optional().describe("One-line subtitle"),
  steps: z
    .array(InfoGraphicStepSchema)
    .min(2)
    .max(6)
    .describe("2-6 data points or process steps"),
  layout: z
    .enum(["flow", "bars", "cards"])
    .describe("'flow' for processes/workflows, 'bars' for comparisons, 'cards' for feature lists"),
});

const ArticleReferenceSchema = z.object({
  headline: z.string().describe("Article headline (5-12 words)"),
  source: z.string().describe("Publication name"),
  date: z.string().optional().describe("Publication date or year"),
  summary: z
    .string()
    .optional()
    .describe("1-2 sentence summary of relevance"),
  section: z.string().optional().describe("Section/category within publication"),
  author: z.string().optional().describe("Author name"),
});

const ConceptPointSchema = z.object({
  text: z.string().describe("Key point (3-8 words)"),
  icon: z
    .enum([
      "currency", "chart", "document", "workflow", "person", "group",
      "chat", "code", "cloud", "lightbulb", "checkmark", "arrow",
      "star", "clock",
    ])
    .optional(),
  detail: z.string().optional().describe("One sentence elaboration"),
});

const ConceptExplainerSchema = z.object({
  title: z.string().describe("Concept name (2-5 words)"),
  intro: z.string().optional().describe("One sentence introduction"),
  points: z
    .array(ConceptPointSchema)
    .min(2)
    .max(5)
    .describe("2-5 key points explaining the concept"),
  conclusion: z.string().optional().describe("One sentence takeaway"),
});

// ─── System prompts per template ────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<string, string> = {
  InfoGraphic: `You are a data visualization designer. Given a content description, generate structured props for an infographic animation.
Rules:
- Title should be clear and professional (3-6 words)
- Choose layout: "flow" for processes/workflows/pipelines, "bars" for numeric comparisons, "cards" for feature/concept lists
- Each step needs a short label and optionally a value (percentage 0-100) and icon
- Use available icons: currency, chart, document, workflow, person, group, chat, code, cloud, lightbulb, checkmark, arrow, star, clock
- Keep descriptions concise (one sentence max)
- Generate 3-5 steps for best visual balance
Return valid JSON matching the schema.`,

  ArticleReference: `You are a news research assistant. Given a content description about an article or news reference, generate structured props for an article citation card.
Rules:
- Headline should be realistic and professional (5-12 words)
- Source should be a real or plausible publication name
- Summary should explain why this article is relevant (1-2 sentences)
- Date should be plausible for the topic
Return valid JSON matching the schema.`,

  ConceptExplainer: `You are an educational content designer. Given a concept description, generate structured props for an animated concept explanation.
Rules:
- Title should name the concept clearly (2-5 words)
- Intro provides brief context (one sentence)
- 3-4 key points that progressively explain the concept
- Each point has a short label and optional detail sentence
- Use available icons: currency, chart, document, workflow, person, group, chat, code, cloud, lightbulb, checkmark, arrow, star, clock
- Conclusion ties it together (one sentence)
Return valid JSON matching the schema.`,
};

// ─── Main conversion function ───────────────────────────────────────────────

export type TemplatePropsResult = {
  compositionId: CompositionId;
  props: Record<string, unknown>;
  durationFrames: number;
};

/**
 * Convert a content mark into structured template props using LLM.
 * For marks that don't need LLM (stock_video, speaking_only, chapter_boundary),
 * returns directly from fallback props.
 */
export async function promptToProps(
  mark: ContentMark,
): Promise<TemplatePropsResult> {
  const route = routeContentMark(mark);

  // If the route doesn't need LLM, use fallback
  if (!route.needsLlmConversion && route.fallbackProps) {
    return {
      compositionId: route.compositionId,
      props: route.fallbackProps(mark) as unknown as Record<string, unknown>,
      durationFrames: route.defaultDurationFrames,
    };
  }

  // For animation type, refine the composition choice
  let compositionId = route.compositionId;
  if (mark.asset_type === "animation") {
    compositionId = routeAnimationMark(mark.search_query);
  }

  // LLM conversion
  const client = getClient();
  const model = getModel();
  const systemPrompt = SYSTEM_PROMPTS[compositionId] || SYSTEM_PROMPTS.ConceptExplainer;

  const schema = getSchemaForComposition(compositionId);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Generate animation props for this content mark:\n\nType: ${mark.asset_type}\nSearch Query: ${mark.search_query}\n\nReturn ONLY valid JSON, no markdown.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty LLM response");
    }

    const parsed = JSON.parse(content);
    const validated = schema.parse(parsed);

    return {
      compositionId,
      props: validated as unknown as Record<string, unknown>,
      durationFrames: calculateDuration(compositionId, validated),
    };
  } catch (error) {
    console.error("LLM conversion failed, using fallback:", error);
    return {
      compositionId,
      props: generateFallbackProps(compositionId, mark) as unknown as Record<string, unknown>,
      durationFrames: route.defaultDurationFrames,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getSchemaForComposition(id: CompositionId): z.ZodType<unknown> {
  switch (id) {
    case "InfoGraphic":
      return InfoGraphicSchema;
    case "ArticleReference":
      return ArticleReferenceSchema;
    case "ConceptExplainer":
      return ConceptExplainerSchema;
    default:
      return ConceptExplainerSchema;
  }
}

/** Calculate appropriate duration based on content density */
function calculateDuration(
  compositionId: CompositionId,
  props: unknown,
): number {
  const FPS = 30;

  switch (compositionId) {
    case "InfoGraphic": {
      const p = props as InfoGraphicProps;
      // Base 3s + 1.5s per step
      return Math.round((3 + p.steps.length * 1.5) * FPS);
    }
    case "ConceptExplainer": {
      const p = props as ConceptExplainerProps;
      // Base 3s + 2s per point + 1.5s for conclusion
      return Math.round(
        (3 + p.points.length * 2 + (p.conclusion ? 1.5 : 0)) * FPS,
      );
    }
    case "ArticleReference": {
      const p = props as ArticleReferenceProps;
      // Base 3s + typewriter time (based on headline length)
      const typewriterSeconds = p.headline.length * 0.04;
      return Math.round((3 + typewriterSeconds + 2) * FPS);
    }
    default:
      return 150; // 5s default
  }
}

/** Generate reasonable fallback props when LLM is unavailable */
function generateFallbackProps(
  compositionId: CompositionId,
  mark: ContentMark,
): Record<string, unknown> {
  const query = mark.search_query;

  switch (compositionId) {
    case "InfoGraphic":
      return {
        title: extractTitle(query),
        subtitle: query,
        steps: [
          { label: "Step 1", icon: "arrow", description: "First stage" },
          { label: "Step 2", icon: "workflow", description: "Processing" },
          { label: "Step 3", icon: "checkmark", description: "Complete" },
        ],
        layout: "flow" as const,
      } satisfies InfoGraphicProps;

    case "ArticleReference":
      return {
        headline: extractTitle(query),
        source: extractSource(query),
        summary: query,
      } satisfies ArticleReferenceProps;

    case "ConceptExplainer":
      return {
        title: extractTitle(query),
        intro: query,
        points: [
          { text: "Key concept", icon: "lightbulb" },
          { text: "How it works", icon: "workflow" },
          { text: "Why it matters", icon: "star" },
        ],
      } satisfies ConceptExplainerProps;

    default:
      return {
        title: extractTitle(query),
        intro: query,
        points: [{ text: query, icon: "lightbulb" }],
      };
  }
}

function extractTitle(query: string): string {
  // Take text before arrow or first 5 words
  const beforeArrow = query.split(/[→\->]/)[0].trim();
  const words = beforeArrow.split(/\s+/).slice(0, 5);
  return words.join(" ");
}

function extractSource(query: string): string {
  // Look for known publication names
  const publications = [
    "Financial Times", "CNBC", "Bloomberg", "Reuters", "Forbes",
    "Wall Street Journal", "The Economist", "Harvard Business Review",
    "TechCrunch", "Wired", "The Guardian", "BBC",
  ];
  for (const pub of publications) {
    if (query.toLowerCase().includes(pub.toLowerCase())) {
      return pub;
    }
  }
  return "Source";
}
