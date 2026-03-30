import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportProgress, exportError, exportOutput, exportFormat } from '../../../src/domains/export/signals';
import { setupExportAdapter } from '../../../src/domains/export/adapter';
import { createEventBus } from '../../../src/shared/event-bus';

function makeTransport() {
  return {
    get: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    post: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    patch: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    broadcastSync: vi.fn(),
  };
}

describe('Export Adapter', () => {
  let bus, transport;

  beforeEach(() => {
    bus = createEventBus();
    transport = makeTransport();
    exportProgress.value = null;
    exportError.value = null;
    exportOutput.value = null;
    exportFormat.value = 'edit_package';
    setupExportAdapter(bus, transport);
  });

  it('export:start sends POST with format', async () => {
    transport.post.mockResolvedValue({ ok: true, data: { output: '/exports/file.zip' } });

    bus.emit('export:start', { projectId: 'proj-1', format: 'premiere' });
    await new Promise(r => setTimeout(r, 10));

    expect(transport.post).toHaveBeenCalledWith('/api/projects/proj-1/export', { format: 'premiere' });
    expect(exportFormat.value).toBe('premiere');
  });

  it('export:start with immediate completion sets output', async () => {
    transport.post.mockResolvedValue({ ok: true, data: { output: '/exports/file.zip' } });
    const handler = vi.fn();
    bus.on('export:completed', handler);

    bus.emit('export:start', { projectId: 'proj-1', format: 'json' });
    await new Promise(r => setTimeout(r, 10));

    expect(exportOutput.value).toBe('/exports/file.zip');
    expect(exportProgress.value).toBeNull();
    expect(handler).toHaveBeenCalled();
  });

  it('export:start sets error on POST failure', async () => {
    transport.post.mockResolvedValue({ ok: false, error: 'Export failed' });
    const handler = vi.fn();
    bus.on('export:error', handler);

    bus.emit('export:start', { projectId: 'proj-1', format: 'csv' });
    await new Promise(r => setTimeout(r, 10));

    expect(exportError.value).toBe('Export failed');
    expect(exportProgress.value).toBeNull();
    expect(handler).toHaveBeenCalledWith({ error: 'Export failed' });
  });

  it('export:start with exportId triggers polling', async () => {
    transport.post.mockResolvedValue({ ok: true, data: { exportId: 'exp-1' } });
    transport.get.mockResolvedValue({ ok: true, data: { status: 'complete', url: '/done.zip' } });

    vi.useFakeTimers();
    bus.emit('export:start', { projectId: 'proj-1', format: 'edit_package' });
    await vi.advanceTimersByTimeAsync(10);

    // Should have set initial progress
    expect(exportProgress.value).toEqual({ percent: 0, label: 'Starting export...' });

    // Advance past poll interval
    await vi.advanceTimersByTimeAsync(2100);

    expect(transport.get).toHaveBeenCalledWith('/api/projects/proj-1/export?exportId=exp-1');
    expect(exportOutput.value).toBe('/done.zip');
    vi.useRealTimers();
  });
});
