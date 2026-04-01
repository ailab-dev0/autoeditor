import { transcript, transcriptError } from './signals';

export function setupTranscriptAdapter(bus, transport) {
  bus.on('transcript:fetch', async ({ projectId }) => {
    transcriptError.value = null;
    const result = await transport.get(`/api/projects/${projectId}/transcript`);

    if (result.ok) {
      // Backend returns { transcripts: [...] } or { transcript: {...} }
      // Unwrap to get the first transcript with its segments
      const raw = result.data;
      const t = raw.transcript ?? raw.transcripts?.[0] ?? raw;
      transcript.value = t;
      bus.emit('transcript:fetched', { projectId });
      transport.broadcastSync('transcript:fetched', { projectId });
    } else {
      transcriptError.value = result.error;
      bus.emit('transcript:error', { error: result.error });
    }
  });
}
