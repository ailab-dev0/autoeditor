import { transcript, transcriptError } from './signals';

export function setupTranscriptAdapter(bus, transport) {
  bus.on('transcript:fetch', async ({ projectId }) => {
    transcriptError.value = null;
    const result = await transport.get(`/api/projects/${projectId}/transcript`);

    if (result.ok) {
      transcript.value = result.data;
      bus.emit('transcript:fetched', { projectId });
      transport.broadcastSync('transcript:fetched', { projectId });
    } else {
      transcriptError.value = result.error;
      bus.emit('transcript:error', { error: result.error });
    }
  });
}
