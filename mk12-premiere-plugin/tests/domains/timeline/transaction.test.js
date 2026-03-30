import { describe, it, expect, vi } from 'vitest';
import { createTransaction, OP_ORDER, VALID_OP_TYPES } from '../../../src/domains/timeline/transaction';

function mockPremiereApi() {
  return {
    removeClip: vi.fn(async () => ({ ok: true, data: { removed: true } })),
    trimClip: vi.fn(async () => ({ ok: true, data: { trimmed: true } })),
    setClipSpeed: vi.fn(async () => ({ ok: true, data: { speed: 1.5 } })),
    moveClip: vi.fn(async () => ({ ok: true, data: { moved: true } })),
    insertTransition: vi.fn(async () => ({ ok: true, data: { inserted: true } })),
    createMarker: vi.fn(async () => ({ ok: true, data: { id: 'marker-1' } })),
  };
}

describe('Transaction', () => {
  describe('operation ordering', () => {
    it('sorts by OP_ORDER: remove < trim < speed < move < insert_clip < transition < marker', () => {
      const ops = [
        { type: 'add_marker', params: { time: 1 } },
        { type: 'move_clip', params: { clipIndex: 0 } },
        { type: 'remove_clip', params: { clipIndex: 2 } },
        { type: 'trim_clip', params: { clipIndex: 1, inPoint: 0, outPoint: 5 } },
        { type: 'set_speed', params: { clipIndex: 0, speed: 1.5 } },
        { type: 'insert_transition', params: { position: 3 } },
      ];

      const tx = createTransaction(ops);
      const sorted = tx.getSorted();

      expect(sorted[0].type).toBe('remove_clip');
      expect(sorted[1].type).toBe('trim_clip');
      expect(sorted[2].type).toBe('set_speed');
      expect(sorted[3].type).toBe('move_clip');
      expect(sorted[4].type).toBe('insert_transition');
      expect(sorted[5].type).toBe('add_marker');
    });

    it('sorts removes by descending clip index to avoid index shifting', () => {
      const ops = [
        { type: 'remove_clip', params: { clipIndex: 1 } },
        { type: 'remove_clip', params: { clipIndex: 5 } },
        { type: 'remove_clip', params: { clipIndex: 3 } },
      ];

      const tx = createTransaction(ops);
      const sorted = tx.getSorted();

      expect(sorted[0].params.clipIndex).toBe(5);
      expect(sorted[1].params.clipIndex).toBe(3);
      expect(sorted[2].params.clipIndex).toBe(1);
    });
  });

  describe('preview', () => {
    it('returns correct operation counts', () => {
      const ops = [
        { type: 'remove_clip', params: {} },
        { type: 'remove_clip', params: {} },
        { type: 'trim_clip', params: { inPoint: 0, outPoint: 5 } },
        { type: 'add_marker', params: { time: 1 } },
      ];

      const tx = createTransaction(ops);
      const preview = tx.preview();

      expect(preview.opCounts.remove_clip).toBe(2);
      expect(preview.opCounts.trim_clip).toBe(1);
      expect(preview.opCounts.add_marker).toBe(1);
      expect(preview.totalOperations).toBe(4);
    });

    it('warns on large number of removals', () => {
      const ops = Array.from({ length: 12 }, (_, i) => ({
        type: 'remove_clip',
        params: { clipIndex: i },
      }));

      const tx = createTransaction(ops);
      const preview = tx.preview();
      expect(preview.warnings.length).toBeGreaterThan(0);
      expect(preview.warnings[0]).toContain('12');
    });

    it('returns empty warnings for normal operations', () => {
      const ops = [{ type: 'trim_clip', params: { inPoint: 0, outPoint: 5 } }];
      const tx = createTransaction(ops);
      expect(tx.preview().warnings).toEqual([]);
    });
  });

  describe('execute', () => {
    it('calls premiere functions in sorted order', async () => {
      const api = mockPremiereApi();
      const callOrder = [];
      api.removeClip.mockImplementation(async () => { callOrder.push('remove'); return { ok: true, data: {} }; });
      api.trimClip.mockImplementation(async () => { callOrder.push('trim'); return { ok: true, data: {} }; });
      api.createMarker.mockImplementation(async () => { callOrder.push('marker'); return { ok: true, data: { id: 'm1' } }; });

      const ops = [
        { type: 'add_marker', params: { time: 1 } },
        { type: 'remove_clip', params: { clipIndex: 0 } },
        { type: 'trim_clip', params: { clipIndex: 1, inPoint: 0, outPoint: 5 } },
      ];

      const tx = createTransaction(ops);
      await tx.execute(api);

      expect(callOrder).toEqual(['remove', 'trim', 'marker']);
    });

    it('returns undo entries', async () => {
      const api = mockPremiereApi();
      const ops = [
        { type: 'remove_clip', params: { clipIndex: 0, trackIndex: 0 } },
        { type: 'set_speed', params: { clipIndex: 1, speed: 2.0 } },
      ];

      const tx = createTransaction(ops);
      const result = await tx.execute(api);

      expect(result.ok).toBe(true);
      expect(result.undoEntries).toHaveLength(2);
      expect(result.undoEntries[0].type).toBe('restore_clip');
      expect(result.undoEntries[1].type).toBe('set_speed');
      expect(result.undoEntries[1].params.speed).toBe(1.0); // original speed
    });

    it('calls onProgress callback per operation', async () => {
      const api = mockPremiereApi();
      const progress = [];
      const ops = [
        { type: 'remove_clip', params: { clipIndex: 0 } },
        { type: 'add_marker', params: { time: 1 } },
      ];

      const tx = createTransaction(ops, (p) => progress.push(p));
      await tx.execute(api);

      expect(progress).toHaveLength(2);
      expect(progress[0]).toEqual({ current: 1, total: 2, label: 'remove_clip' });
      expect(progress[1]).toEqual({ current: 2, total: 2, label: 'add_marker' });
    });
  });

  describe('rollback', () => {
    it('replays undo stack in reverse order', async () => {
      const api = mockPremiereApi();
      const callOrder = [];

      // Execute returns ok, rollback tracks call order
      let phase = 'execute';
      api.trimClip.mockImplementation(async () => {
        if (phase === 'rollback') callOrder.push('undo-trim');
        return { ok: true, data: { trimmed: true } };
      });
      api.setClipSpeed.mockImplementation(async () => {
        if (phase === 'rollback') callOrder.push('undo-speed');
        return { ok: true, data: { speed: 1.5 } };
      });

      const ops = [
        { type: 'trim_clip', params: { clipIndex: 0, inPoint: 0, outPoint: 10, originalInPoint: 0, originalOutPoint: 10 } },
        { type: 'set_speed', params: { clipIndex: 1, speed: 2.0 } },
      ];

      const tx = createTransaction(ops);
      await tx.execute(api);

      phase = 'rollback';
      await tx.rollback(api);

      // Reverse order: speed undo first, then trim undo
      expect(callOrder).toEqual(['undo-speed', 'undo-trim']);
    });
  });

  describe('validation', () => {
    it('rejects invalid operation types', () => {
      expect(() => createTransaction([{ type: 'invalid_op', params: {} }]))
        .toThrow('Invalid operation type "invalid_op"');
    });

    it('accepts all valid operation types', () => {
      for (const type of VALID_OP_TYPES) {
        expect(() => createTransaction([{ type, params: { inPoint: 0, outPoint: 5 } }]))
          .not.toThrow();
      }
    });
  });
});
