import { graphData, knowledgeError } from './signals';
import { addToast } from '../../shared/errors';

export function setupKnowledgeAdapter(bus, transport) {
  bus.on('knowledge:fetch', async ({ projectId, conceptId }) => {
    if (conceptId) return; // research handled separately below
    knowledgeError.value = null;
    const result = await transport.get(`/api/projects/${projectId}/knowledge`);

    if (result.ok) {
      // Backend returns { graph: { nodes, edges } } — unwrap
      const raw = result.data;
      graphData.value = raw.graph ?? raw;
      bus.emit('knowledge:fetched', { projectId });
      transport.broadcastSync('knowledge:fetched', { projectId });
    } else {
      knowledgeError.value = result.error;
      addToast(result.error, 'backend');
      bus.emit('knowledge:error', { error: result.error });
    }
  });
}
