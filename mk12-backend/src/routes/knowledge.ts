/**
 * Knowledge graph routes.
 *
 * GET /api/projects/:id/knowledge           — full graph data
 * GET /api/projects/:id/knowledge/concepts  — top concepts by importance
 * GET /api/projects/:id/knowledge/clusters  — community clusters
 */

import type { FastifyInstance } from 'fastify';
import {
  getGraph,
  getTopConcepts,
  getCommunityClusters,
  getPrerequisiteChain,
} from '../services/knowledge-service.js';

export async function registerKnowledgeRoutes(app: FastifyInstance): Promise<void> {
  // Get full knowledge graph
  app.get('/api/projects/:id/knowledge', async (req, reply) => {
    const { id } = req.params as { id: string };
    const graph = await getGraph(id);
    return reply.send({ graph });
  });

  // Get top concepts by importance
  app.get('/api/projects/:id/knowledge/concepts', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as Record<string, string | undefined>;
    const limit = parseInt(query.limit ?? '20', 10);

    const concepts = await getTopConcepts(id, limit);
    return reply.send({ concepts });
  });

  // Get community clusters
  app.get('/api/projects/:id/knowledge/clusters', async (req, reply) => {
    const { id } = req.params as { id: string };
    const clusters = await getCommunityClusters(id);

    // Convert Map to serializable object
    const result: Record<number, unknown[]> = {};
    for (const [community, nodes] of clusters) {
      result[community] = nodes;
    }

    return reply.send({ clusters: result });
  });

  // Get prerequisite chain for a concept
  app.get('/api/projects/:id/knowledge/prerequisites/:conceptId', async (req, reply) => {
    const { id, conceptId } = req.params as { id: string; conceptId: string };
    const chain = await getPrerequisiteChain(id, conceptId);
    return reply.send({ prerequisites: chain });
  });
}
