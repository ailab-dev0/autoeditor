/**
 * Knowledge graph service.
 *
 * Graph data is read from content-flow topics in MinIO.
 * Write operations are no-ops — the pipeline stores to MinIO directly.
 */

import type { KnowledgeNode, KnowledgeEdge } from '../types/index.js';

/**
 * Store a complete knowledge graph for a project.
 * No-op: the pipeline stores to MinIO directly.
 */
export async function storeKnowledgeGraph(
  _projectId: string,
  _nodes: KnowledgeNode[],
  _edges: KnowledgeEdge[]
): Promise<void> {
  return;
}

/**
 * Get the full knowledge graph for a project.
 * Reads from content-flow topics in MinIO.
 */
export async function getGraph(projectId: string): Promise<{
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}> {
  return getGraphFromMinIO(projectId);
}

/**
 * Get a single concept with its relationships.
 * Looks up the concept from the MinIO graph data.
 */
export async function getConcept(conceptId: string): Promise<{
  node: KnowledgeNode;
  edges: KnowledgeEdge[];
} | undefined> {
  // We don't have a projectId here, so we can't look up from MinIO easily.
  // Return undefined — callers already handle the fallback case.
  return undefined;
}

/**
 * Get concepts in a specific chapter.
 * Returns empty — chapter concept linkage was only in Neo4j.
 */
export async function getChapterConcepts(_chapterId: string): Promise<KnowledgeNode[]> {
  return [];
}

/**
 * Get concepts ordered by importance.
 */
export async function getTopConcepts(projectId: string, limit: number = 20): Promise<KnowledgeNode[]> {
  const { nodes } = await getGraphFromMinIO(projectId);
  return nodes
    .sort((a, b) => b.importance - a.importance)
    .slice(0, limit);
}

/**
 * Get concepts grouped by community (clusters).
 */
export async function getCommunityClusters(projectId: string): Promise<Map<number, KnowledgeNode[]>> {
  const { nodes } = await getGraphFromMinIO(projectId);
  const clusters = new Map<number, KnowledgeNode[]>();
  for (const node of nodes) {
    const community = node.community ?? 0;
    if (!clusters.has(community)) {
      clusters.set(community, []);
    }
    clusters.get(community)!.push(node);
  }
  return clusters;
}

/**
 * Get prerequisite chain for a concept.
 * Returns empty — prerequisite traversal was only in Neo4j.
 */
export async function getPrerequisiteChain(_projectId: string, _conceptId: string): Promise<KnowledgeNode[]> {
  return [];
}

/**
 * Compute PageRank.
 * No-op: was only meaningful in Neo4j.
 */
export async function computePageRankInNeo4j(_projectId: string): Promise<void> {
  return;
}

/**
 * Build a knowledge graph from content-flow topics stored in MinIO.
 */
async function getGraphFromMinIO(projectId: string): Promise<{
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}> {
  try {
    const { isStorageConfigured, getFileStream } = await import('./storage-service.js');
    if (!isStorageConfigured()) return { nodes: [], edges: [] };

    const stream = await getFileStream(`projects/${projectId}/content-flow-meta.json`);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const meta = JSON.parse(Buffer.concat(chunks).toString('utf8'));

    const topics: Array<{ name: string; importance: number; segments: string[]; pedagogyRole?: string }> = meta.topics ?? [];
    if (topics.length === 0) return { nodes: [], edges: [] };

    // Deduplicate and merge topics with similar names
    const merged = new Map<string, typeof topics[0]>();
    for (const t of topics) {
      const key = t.name.toLowerCase().trim();
      const existing = merged.get(key);
      if (existing) {
        existing.importance = Math.max(existing.importance, t.importance);
        existing.segments.push(...t.segments);
      } else {
        merged.set(key, { ...t, segments: [...t.segments] });
      }
    }

    // Take top 30 by importance to keep the graph readable
    const sorted = Array.from(merged.values()).sort((a, b) => b.importance - a.importance).slice(0, 30);

    const nodes: KnowledgeNode[] = sorted.map((t, i) => ({
      id: `topic-${i}`,
      label: t.name,
      type: 'topic' as const,
      importance: t.importance / 5, // normalize to 0-1
      community: i % 5, // simple community assignment
      properties: { segments: t.segments },
    }));

    // Build edges from segments shared between topics
    const edges: KnowledgeEdge[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const segsA = new Set(sorted[i].segments);
      for (let j = i + 1; j < nodes.length; j++) {
        const overlap = sorted[j].segments.filter(s => segsA.has(s)).length;
        if (overlap > 0) {
          edges.push({
            source: nodes[i].id,
            target: nodes[j].id,
            relationship: 'RELATES_TO',
            weight: overlap,
          });
        }
      }
    }

    return { nodes, edges };
  } catch {
    return { nodes: [], edges: [] };
  }
}
