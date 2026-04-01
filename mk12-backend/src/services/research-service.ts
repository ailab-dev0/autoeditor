/**
 * Deep Research service.
 *
 * Uses OpenRouter (Claude) to generate research briefs for knowledge graph
 * concepts. Stores results in MinIO as JSON files.
 */

import { v4 as uuid } from 'uuid';
import { config } from '../config.js';
import { getConcept } from './knowledge-service.js';

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

export interface ResearchSource {
  title: string;
  url?: string;
  type: 'article' | 'paper' | 'report';
}

export interface ResearchResult {
  id: string;
  concept: string;
  concept_id: string;
  summary: string;
  keyFacts: string[];
  sources: ResearchSource[];
  teachingNotes: string;
  visualSuggestions: string[];
  created_at: string;
  project_id: string;
}

// ──────────────────────────────────────────────────────────────────
// OpenRouter client
// ──────────────────────────────────────────────────────────────────

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: { content: string };
  }>;
}

async function callOpenRouter(messages: OpenRouterMessage[]): Promise<string> {
  if (!config.openrouterApiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured. Set it in your .env file to enable AI research.',
    );
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.openrouterApiKey}`,
      'HTTP-Referer': 'https://editorlens.dev',
      'X-Title': 'EditorLens MK-12',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      messages,
      max_tokens: 4096,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error');
    throw new Error(`OpenRouter API error ${res.status}: ${body}`);
  }

  const data: OpenRouterResponse = await res.json();
  return data.choices[0]?.message?.content ?? '';
}

// ──────────────────────────────────────────────────────────────────
// Research prompt
// ──────────────────────────────────────────────────────────────────

function buildResearchPrompt(conceptName: string, conceptType: string, context?: string): string {
  let prompt = `Research the concept "${conceptName}" (type: ${conceptType}) for use in an educational video editing context.`;

  if (context) {
    prompt += `\n\nAdditional context from the video transcript:\n${context}`;
  }

  prompt += `

Provide a comprehensive research brief in the following JSON format:
{
  "summary": "A 2-3 paragraph summary of the concept suitable for an educational video editor",
  "keyFacts": ["Fact 1", "Fact 2", ...],
  "sources": [
    {"title": "Source Title", "url": "https://example.com", "type": "article|paper|report"},
    ...
  ],
  "teachingNotes": "Notes on how to best present this concept in video format, including pacing, visual cues, and common misconceptions to address",
  "visualSuggestions": ["Suggestion 1 for visual representation", "Suggestion 2", ...]
}

Requirements:
- Provide 5-10 key facts
- Include 3-5 credible sources (use real, well-known references)
- Teaching notes should be practical and specific to video editing
- Visual suggestions should be actionable for a video editor
- Keep the summary informative but concise
- Respond ONLY with valid JSON, no markdown wrapping`;

  return prompt;
}

// ──────────────────────────────────────────────────────────────────
// MinIO helpers for research storage
// ──────────────────────────────────────────────────────────────────

function researchKey(projectId: string, conceptId: string): string {
  return `projects/${projectId}/research/${conceptId}.json`;
}

function researchIndexKey(projectId: string): string {
  return `projects/${projectId}/research/index.json`;
}

async function loadResearchFromMinIO(projectId: string, conceptId: string): Promise<ResearchResult | null> {
  try {
    const { isStorageConfigured, getFileStream } = await import('./storage-service.js');
    if (!isStorageConfigured()) return null;

    const stream = await getFileStream(researchKey(projectId, conceptId));
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

async function saveResearchToMinIO(projectId: string, conceptId: string, research: ResearchResult): Promise<void> {
  try {
    const { isStorageConfigured, uploadFile } = await import('./storage-service.js');
    if (!isStorageConfigured()) return;

    await uploadFile(
      researchKey(projectId, conceptId),
      Buffer.from(JSON.stringify(research, null, 2)),
      'application/json',
    );

    // Update the index (best-effort)
    try {
      const index = await loadResearchIndex(projectId);
      if (!index.find(e => e.concept_id === conceptId)) {
        index.push({ concept_id: conceptId, concept: research.concept, id: research.id });
      }
      await uploadFile(
        researchIndexKey(projectId),
        Buffer.from(JSON.stringify(index, null, 2)),
        'application/json',
      );
    } catch {
      // Index update is best-effort
    }
  } catch (err) {
    console.warn('[research] Failed to save to MinIO:', (err as Error).message);
  }
}

async function loadResearchIndex(projectId: string): Promise<Array<{ concept_id: string; concept: string; id: string }>> {
  try {
    const { isStorageConfigured, getFileStream } = await import('./storage-service.js');
    if (!isStorageConfigured()) return [];

    const stream = await getFileStream(researchIndexKey(projectId));
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────────────────────────

export class ResearchService {
  /**
   * Research a single concept by its ID.
   */
  async researchConcept(projectId: string, conceptId: string): Promise<ResearchResult> {
    // Check if we already have research for this concept
    const existing = await this.getResearch(projectId, conceptId);
    if (existing) {
      console.log(`[research] Using existing research for concept ${conceptId}`);
      return existing;
    }

    // Try to get the concept from knowledge service, fall back to using the conceptId as the label
    let conceptLabel = conceptId;
    let conceptType = 'concept';

    try {
      const conceptData = await getConcept(conceptId);
      if (conceptData) {
        conceptLabel = conceptData.node.label;
        conceptType = conceptData.node.type ?? 'concept';
      }
    } catch {
      // getConcept unavailable — use conceptId as label (the dashboard passes the label as ID for MinIO-derived nodes)
      console.warn(`[research] Concept lookup failed for ${conceptId}, using as label`);
    }

    console.log(`[research] Researching concept: "${conceptLabel}" (${conceptType})`);

    // Call OpenRouter for research synthesis
    const prompt = buildResearchPrompt(conceptLabel, conceptType);

    const response = await callOpenRouter([
      {
        role: 'system',
        content: 'You are a research assistant for EditorLens, an AI-powered video editing platform. You provide well-structured research briefs to help video editors understand and present educational concepts effectively.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ]);

    // Parse the response
    let parsed: {
      summary: string;
      keyFacts: string[];
      sources: ResearchSource[];
      teachingNotes: string;
      visualSuggestions: string[];
    };

    try {
      // Strip markdown code fences if present
      const cleaned = response.replace(/^```json?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error('[research] Failed to parse AI response:', response.slice(0, 500));
      throw new Error('Failed to parse research response from AI');
    }

    const researchResult: ResearchResult = {
      id: uuid(),
      concept: conceptLabel,
      concept_id: conceptId,
      summary: parsed.summary,
      keyFacts: parsed.keyFacts ?? [],
      sources: parsed.sources ?? [],
      teachingNotes: parsed.teachingNotes ?? '',
      visualSuggestions: parsed.visualSuggestions ?? [],
      created_at: new Date().toISOString(),
      project_id: projectId,
    };

    // Store in MinIO
    await saveResearchToMinIO(projectId, conceptId, researchResult);

    return researchResult;
  }

  /**
   * Get existing research for a concept.
   */
  async getResearch(projectId: string, conceptId: string): Promise<ResearchResult | null> {
    return loadResearchFromMinIO(projectId, conceptId);
  }

  /**
   * List all research results for a project.
   */
  async listResearch(projectId: string): Promise<ResearchResult[]> {
    const index = await loadResearchIndex(projectId);
    const results: ResearchResult[] = [];

    for (const entry of index) {
      const research = await loadResearchFromMinIO(projectId, entry.concept_id);
      if (research) results.push(research);
    }

    return results;
  }

  /**
   * Bulk research all concepts in a project.
   * Processes concepts sequentially to avoid rate-limiting.
   */
  async bulkResearch(projectId: string): Promise<ResearchResult[]> {
    // Get concepts from knowledge graph (MinIO-backed)
    const { getTopConcepts } = await import('./knowledge-service.js');
    const concepts = await getTopConcepts(projectId, 100);

    if (concepts.length === 0) {
      throw new Error('No concepts found for this project. Run the pipeline first.');
    }

    console.log(`[research] Bulk researching ${concepts.length} concepts for project ${projectId}`);

    const results: ResearchResult[] = [];

    for (const concept of concepts) {
      try {
        const result = await this.researchConcept(projectId, concept.id);
        results.push(result);
      } catch (err) {
        console.error(`[research] Failed to research concept ${concept.id}:`, (err as Error).message);
        // Continue with other concepts
      }
    }

    return results;
  }
}

// ──────────────────────────────────────────────────────────────────
// Singleton
// ──────────────────────────────────────────────────────────────────

let instance: ResearchService | null = null;

export function getResearchService(): ResearchService {
  if (!instance) {
    instance = new ResearchService();
  }
  return instance;
}
