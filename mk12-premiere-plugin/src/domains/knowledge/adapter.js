import { graphData, knowledgeError } from './signals';

export function setupKnowledgeAdapter(bus, transport) {
  bus.on('knowledge:fetch', async ({ projectId, conceptId }) => {
    if (conceptId) return; // research handled separately below
    knowledgeError.value = null;
    const result = await transport.get(`/api/projects/${projectId}/knowledge`);

    if (result.ok) {
      graphData.value = result.data;
      bus.emit('knowledge:fetched', { projectId });
      transport.broadcastSync('knowledge:fetched', { projectId });
    } else {
      knowledgeError.value = result.error;
      bus.emit('knowledge:error', { error: result.error });
    }
  });
}
