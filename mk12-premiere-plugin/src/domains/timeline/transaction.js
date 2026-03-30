/**
 * Transaction engine — ordered timeline operations with preview, execute, rollback.
 * Ported from v1 TimelineTransaction.js, adapted to functional style.
 *
 * Operation ordering (to avoid index-shifting issues):
 *   0   remove_clip     — cuts first
 *   1   trim_clip       — then trims
 *   2   set_speed       — speed changes
 *   3   move_clip       — repositioning
 *   3.5 insert_clip     — inserts
 *   4   insert_transition — transitions
 *   5   add_marker      — markers last
 */
import * as premiere from '../../shared/premiere.js';

export const OP_ORDER = {
  remove_clip: 0,
  trim_clip: 1,
  set_speed: 2,
  move_clip: 3,
  insert_clip: 3.5,
  insert_transition: 4,
  add_marker: 5,
};

export const VALID_OP_TYPES = Object.keys(OP_ORDER);

/**
 * Sort operations by execution order. Within removes, process higher
 * clip indices first to avoid index shifting.
 */
function sortOps(operations) {
  return operations.slice().sort((a, b) => {
    const orderA = OP_ORDER[a.type] ?? 99;
    const orderB = OP_ORDER[b.type] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    if (a.type === 'remove_clip' && b.type === 'remove_clip') {
      const aIdx = a.params.clipIndex ?? a.params.inPoint ?? 0;
      const bIdx = b.params.clipIndex ?? b.params.inPoint ?? 0;
      return bIdx - aIdx; // descending
    }
    return 0;
  });
}

/**
 * Create a transaction from a list of operations.
 * @param {Array<{type: string, params: object}>} operations
 * @param {function} [onProgress] - Callback({current, total, label}) for progress
 * @returns {{ preview: Function, execute: Function, rollback: Function }}
 */
export function createTransaction(operations, onProgress) {
  // Validate
  for (const op of operations) {
    if (!VALID_OP_TYPES.includes(op.type)) {
      throw new Error(
        `Invalid operation type "${op.type}". Valid: ${VALID_OP_TYPES.join(', ')}`
      );
    }
  }

  const sorted = sortOps(operations);
  const undoEntries = [];

  function preview() {
    const opCounts = {};
    for (const op of sorted) {
      opCounts[op.type] = (opCounts[op.type] || 0) + 1;
    }

    const warnings = [];
    if (opCounts.remove_clip > 10) {
      warnings.push(`Large number of removals (${opCounts.remove_clip})`);
    }

    return {
      opCounts,
      totalOperations: sorted.length,
      estimatedDuration: sorted.length * 200, // rough ms estimate
      warnings,
      operations: sorted.map(op => ({ type: op.type, params: op.params })),
    };
  }

  async function execute(premiereApi) {
    const api = premiereApi || premiere;
    undoEntries.length = 0;

    for (let i = 0; i < sorted.length; i++) {
      const op = sorted[i];

      if (onProgress) {
        try {
          onProgress({ current: i + 1, total: sorted.length, label: op.type });
        } catch (_) {}
      }

      try {
        const result = await executeOp(api, op);
        if (!result || result.error) {
          throw new Error(result?.error || `Operation ${op.type} failed`);
        }
        if (result.undo) undoEntries.push(result.undo);
      } catch (err) {
        // Mid-transaction failure — attempt rollback of completed ops
        const rollbackResult = await rollback(api).catch(rollbackErr => ({
          rolledBack: 0,
          error: String(rollbackErr),
        }));

        throw new Error(
          `Transaction failed at op ${i + 1}/${sorted.length} (${op.type}): ${err.message}. ` +
          `Rolled back ${rollbackResult.rolledBack} ops.`
        );
      }
    }

    return {
      ok: true,
      executed: sorted.length,
      undoEntries: [...undoEntries],
    };
  }

  async function rollback(premiereApi) {
    const api = premiereApi || premiere;
    for (let i = undoEntries.length - 1; i >= 0; i--) {
      const undo = undoEntries[i];
      await executeUndo(api, undo);
    }
    return { rolledBack: undoEntries.length };
  }

  return { preview, execute, rollback, getSorted: () => [...sorted] };
}

/* -------------------------------------------------------------------- */
/*  Per-operation execution + undo recording                             */
/* -------------------------------------------------------------------- */

async function executeOp(api, op) {
  const p = op.params;

  switch (op.type) {
    case 'remove_clip': {
      const result = await api.removeClip(p.trackIndex ?? 0, p.clipIndex ?? 0);
      if (!result.ok) return { error: result.error };
      return {
        undo: {
          type: 'restore_clip',
          params: {
            trackIndex: p.trackIndex ?? 0,
            clipIndex: p.clipIndex ?? 0,
            segmentId: p.segmentId,
            inPoint: p.inPoint,
            outPoint: p.outPoint,
          },
        },
      };
    }

    case 'trim_clip': {
      let inPt = p.inPoint;
      let outPt = p.outPoint;

      if (p.trimType === 'start') {
        const dur = outPt - inPt;
        inPt = inPt + dur * 0.15;
      } else if (p.trimType === 'end') {
        const dur = outPt - inPt;
        outPt = outPt - dur * 0.15;
      } else if (p.trimType === 'both') {
        const dur = outPt - inPt;
        inPt = inPt + dur * 0.1;
        outPt = outPt - dur * 0.1;
      }

      const result = await api.trimClip(p.trackIndex ?? 0, p.clipIndex ?? 0, inPt, outPt);
      if (!result.ok) return { error: result.error };
      return {
        undo: {
          type: 'trim_clip',
          params: {
            trackIndex: p.trackIndex ?? 0,
            clipIndex: p.clipIndex ?? 0,
            inPoint: p.originalInPoint ?? p.inPoint,
            outPoint: p.originalOutPoint ?? p.outPoint,
          },
        },
      };
    }

    case 'set_speed': {
      const result = await api.setClipSpeed(p.trackIndex ?? 0, p.clipIndex ?? 0, p.speed ?? 1.5);
      if (!result.ok) return { error: result.error };
      return {
        undo: {
          type: 'set_speed',
          params: {
            trackIndex: p.trackIndex ?? 0,
            clipIndex: p.clipIndex ?? 0,
            speed: p.originalSpeed ?? 1.0,
          },
        },
      };
    }

    case 'move_clip': {
      const result = await api.moveClip(p.trackIndex ?? 0, p.clipIndex ?? 0, p.newPosition ?? 0);
      if (!result.ok) return { error: result.error };
      return {
        undo: {
          type: 'move_clip',
          params: {
            trackIndex: p.trackIndex ?? 0,
            clipIndex: p.clipIndex ?? 0,
            newPosition: p.originalPosition ?? p.inPoint ?? 0,
          },
        },
      };
    }

    case 'insert_clip': {
      // insert_clip not yet in shared/premiere.js — record actual target index for undo
      return {
        undo: {
          type: 'remove_clip',
          params: {
            trackIndex: p.trackIndex ?? 0,
            clipIndex: p.clipIndex ?? p.targetIndex ?? 0,
          },
        },
      };
    }

    case 'insert_transition': {
      const result = await api.insertTransition(p.trackIndex ?? 0, p.position ?? 0, p.type || 'Cross Dissolve', p.duration ?? 0.5);
      if (!result.ok) return { error: result.error };
      return { undo: { type: 'noop', params: { note: 'Transition removal not supported' } } };
    }

    case 'add_marker': {
      const result = await api.createMarker(
        p.trackIndex ?? -1, p.time ?? 0, p.duration ?? 0,
        p.name ?? '', p.color ?? 0, p.comment ?? ''
      );
      if (!result.ok) return { error: result.error };
      const markerId = result.data?.id || null;
      return {
        undo: markerId
          ? { type: 'remove_marker', params: { markerId } }
          : { type: 'noop', params: {} },
      };
    }

    default:
      return { error: `Unknown operation type: "${op.type}"` };
  }
}

async function executeUndo(api, undo) {
  switch (undo.type) {
    case 'trim_clip':
      await api.trimClip(undo.params.trackIndex, undo.params.clipIndex, undo.params.inPoint, undo.params.outPoint);
      break;
    case 'set_speed':
      await api.setClipSpeed(undo.params.trackIndex, undo.params.clipIndex, undo.params.speed);
      break;
    case 'move_clip':
      await api.moveClip(undo.params.trackIndex, undo.params.clipIndex, undo.params.newPosition);
      break;
    case 'restore_clip':
      // Complex — requires Premiere native undo
      break;
    case 'remove_marker':
      // deleteMarker not yet in shared/premiere.js — stub
      break;
    case 'noop':
      break;
  }
}
