/**
 * Knowledge graph construction module.
 *
 * Extracts concepts from transcript text, builds relationships,
 * and stores the graph in Neo4j for PageRank and community analysis.
 *
 * When OpenRouter API key is available, uses AI for concept extraction.
 * Otherwise falls back to keyword-based extraction (real, not mock).
 */

import { v4 as uuid } from 'uuid';
import { config } from '../config.js';
import type { KnowledgeNode, KnowledgeEdge } from '../types/index.js';

interface ExtractedConcept {
  label: string;
  type: KnowledgeNode['type'];
  mentions: number;
  context: string[];
}

/**
 * Extract concepts from transcript text.
 */
export async function extractConcepts(
  text: string,
  brief?: string
): Promise<ExtractedConcept[]> {
  if (config.openrouterApiKey) {
    try {
      return await extractConceptsWithAI(text, brief);
    } catch (err) {
      console.warn('[knowledge-graph] AI extraction failed, falling back to keyword extraction:', (err as Error).message);
    }
  }

  return extractConceptsKeyword(text);
}

/**
 * Build a knowledge graph from extracted concepts.
 *
 * Builds edges based on co-occurrence: concepts that appear in
 * the same sentence get a BUILDS_UPON relationship.
 * Concepts with significantly more mentions are marked as PREREQUISITE_OF.
 */
export async function buildKnowledgeGraph(concepts: ExtractedConcept[]): Promise<{
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}> {
  const nodes: KnowledgeNode[] = concepts.map((c) => ({
    id: uuid(),
    label: c.label,
    type: c.type,
    importance: 0, // Will be computed by PageRank in Neo4j
    properties: {
      mentions: c.mentions,
      context: c.context.slice(0, 3),
    },
  }));

  const edges: KnowledgeEdge[] = [];

  // Build edges based on co-occurrence in context sentences
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const nodeA = nodes[i];
      const nodeB = nodes[j];
      const conceptA = concepts[i];
      const conceptB = concepts[j];

      // Check co-occurrence: concepts in same sentence = BUILDS_UPON
      const sharedContexts = conceptA.context.filter((ctx) =>
        conceptB.context.some((ctx2) => {
          // Same sentence check
          if (ctx === ctx2) return true;
          // Nearby context overlap check
          const overlap = ctx.split(' ').filter((w) => ctx2.includes(w)).length;
          return overlap > 3;
        })
      );

      if (sharedContexts.length > 0) {
        const weight = Math.min(1, sharedContexts.length / Math.max(conceptA.context.length, 1));

        // Determine relationship type
        let relationship = 'RELATES_TO';
        if (conceptA.type === 'skill' && conceptB.type === 'concept') {
          // Skills build upon concepts
          relationship = 'BUILDS_UPON';
        } else if (conceptA.mentions > conceptB.mentions * 1.5) {
          // More-mentioned concepts are prerequisites
          relationship = 'PREREQUISITE_OF';
        } else if (sharedContexts.length > 0) {
          // Co-occurrence in same sentence = builds upon
          relationship = 'BUILDS_UPON';
        }

        edges.push({
          source: nodeA.id,
          target: nodeB.id,
          relationship,
          weight: Math.round(weight * 100) / 100,
        });
      }
    }
  }

  return { nodes, edges };
}

// ── AI-powered concept extraction ────────────────────────────

async function extractConceptsWithAI(text: string, brief?: string): Promise<ExtractedConcept[]> {
  const prompt = `Extract key concepts, topics, entities, and skills from the following transcript text.
${brief ? `Context/brief: ${brief}\n` : ''}
Return a JSON array where each item has:
- "label": concept name (string)
- "type": one of "concept", "topic", "entity", "skill"
- "mentions": approximate number of times mentioned (number)
- "context": array of 1-3 short sentences where this concept appears

Text:
${text.slice(0, 8000)}

Return ONLY valid JSON array, no other text.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.openrouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://editorlens.dev',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4',
      messages: [
        { role: 'system', content: 'You are a knowledge extraction assistant. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content ?? '[]';

  // Parse JSON from response (handle markdown code blocks)
  const jsonStr = content.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(jsonStr);

  if (!Array.isArray(parsed)) {
    throw new Error('AI response is not an array');
  }

  return parsed.map((item: any) => ({
    label: String(item.label ?? ''),
    type: ['concept', 'topic', 'entity', 'skill'].includes(item.type) ? item.type : 'concept',
    mentions: Number(item.mentions) || 1,
    context: Array.isArray(item.context) ? item.context.map(String) : [],
  }));
}

// ── Keyword-based concept extraction (fallback) ──────────────

function extractConceptsKeyword(text: string): ExtractedConcept[] {
  // Split into sentences
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);

  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'can', 'shall', 'this', 'that',
    'these', 'those', 'it', 'its', 'we', 'you', 'they', 'them', 'their',
    'our', 'your', 'my', 'his', 'her', 'not', 'no', 'so', 'if', 'then',
    'than', 'when', 'what', 'which', 'who', 'how', 'all', 'each', 'every',
    'both', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'very',
    'just', 'also', 'now', 'here', 'there', 'up', 'out', 'about', 'into',
    'over', 'after', 'before', 'between', 'under', 'again', 'let', 'us',
    'look', 'today', 'next', 'notice', 'remember', 'start', 'save',
  ]);

  // Count word/phrase frequencies
  const wordCounts = new Map<string, { count: number; contexts: string[] }>();

  for (const sentence of sentences) {
    const words = sentence.toLowerCase().trim().split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w));

    // Single words
    for (const word of words) {
      const clean = word.replace(/[^a-z0-9-]/g, '');
      if (clean.length < 4) continue;

      if (!wordCounts.has(clean)) {
        wordCounts.set(clean, { count: 0, contexts: [] });
      }
      const entry = wordCounts.get(clean)!;
      entry.count++;
      if (entry.contexts.length < 3) {
        entry.contexts.push(sentence.trim());
      }
    }

    // Bigrams
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i].replace(/[^a-z0-9-]/g, '')} ${words[i + 1].replace(/[^a-z0-9-]/g, '')}`;
      if (bigram.length < 6) continue;

      if (!wordCounts.has(bigram)) {
        wordCounts.set(bigram, { count: 0, contexts: [] });
      }
      const entry = wordCounts.get(bigram)!;
      entry.count++;
      if (entry.contexts.length < 3) {
        entry.contexts.push(sentence.trim());
      }
    }
  }

  // Filter to significant terms (mentioned 2+ times) and sort by frequency
  const concepts: ExtractedConcept[] = [];
  for (const [term, data] of wordCounts) {
    if (data.count >= 2) {
      concepts.push({
        label: term,
        type: term.includes(' ') ? 'topic' : 'concept',
        mentions: data.count,
        context: data.contexts,
      });
    }
  }

  // Sort by mentions desc, take top 30
  concepts.sort((a, b) => b.mentions - a.mentions);
  return concepts.slice(0, 30);
}
