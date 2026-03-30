import { exportFormat, exportProgress, exportError, exportOutput } from './signals';
import { addToast } from '../../shared/errors';

const POLL_INTERVAL = 2000;

export function setupExportAdapter(bus, transport) {
  bus.on('export:start', async ({ projectId, format }) => {
    if (format) exportFormat.value = format;
    exportError.value = null;
    exportOutput.value = null;
    exportProgress.value = { percent: 0, label: 'Starting export...' };

    const result = await transport.post(`/api/projects/${projectId}/export`, {
      format: format || exportFormat.value,
    });

    if (!result.ok) {
      exportProgress.value = null;
      exportError.value = result.error;
      addToast(result.error, 'backend');
      bus.emit('export:error', { error: result.error });
      return;
    }

    // Poll for completion
    const exportId = result.data?.exportId || result.data?.id;
    if (exportId) {
      const poll = async () => {
        const status = await transport.get(`/api/projects/${projectId}/export?exportId=${exportId}`);
        if (!status.ok) {
          exportProgress.value = null;
          exportError.value = status.error;
          addToast(status.error, 'backend');
          bus.emit('export:error', { error: status.error });
          return;
        }

        if (status.data?.status === 'complete') {
          exportProgress.value = null;
          exportOutput.value = status.data.url || status.data.output;
          bus.emit('export:completed', { output: exportOutput.value });
          transport.broadcastSync('export:completed', { output: exportOutput.value });
          return;
        }

        exportProgress.value = {
          percent: status.data?.percent || 0,
          label: status.data?.label || 'Exporting...',
        };
        setTimeout(poll, POLL_INTERVAL);
      };
      setTimeout(poll, POLL_INTERVAL);
    } else {
      // Immediate completion (no polling needed)
      exportProgress.value = null;
      exportOutput.value = result.data?.url || result.data?.output || null;
      bus.emit('export:completed', { output: exportOutput.value });
      transport.broadcastSync('export:completed', { output: exportOutput.value });
    }
  });
}
