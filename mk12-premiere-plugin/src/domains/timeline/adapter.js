/**
 * Timeline adapter — handles preview, apply, rollback intents.
 */
import {
  transactionState, transactionPreview, undoStack,
  applyProgress, timelineError,
} from './signals.js';
import { createTimelineFsm } from './fsm.js';
import { createTransaction } from './transaction.js';
import { segments, approvals } from '../segments/signals.js';
import { toTimelineOperations } from '../segments/operations.js';
import { addToast, categorizeError } from '../../shared/errors.js';

export function setupTimelineAdapter(bus, transport) {
  const fsm = createTimelineFsm(bus);
  let activeTransaction = null;

  bus.on('timeline:preview', () => {
    timelineError.value = null;

    // Explicit approval-count guard (#8)
    const apps = approvals.value;
    const approvedCount = Object.values(apps).filter(s => s === 'approved').length;
    if (approvedCount === 0) {
      timelineError.value = 'No segments approved';
      return;
    }

    const rawOps = toTimelineOperations(segments.value, apps);
    if (rawOps.length === 0) {
      timelineError.value = 'No actionable operations from approved segments';
      return;
    }

    // Wrap flat ops from operations.js into {type, params} for createTransaction.
    // Filter out 'keep' ops — they're informational, not executable.
    const ops = rawOps
      .filter(op => op.type !== 'keep')
      .map(op => {
        const { type, ...params } = op;
        return { type, params };
      });

    try {
      const onProgress = (p) => { applyProgress.value = p; };
      activeTransaction = createTransaction(ops, onProgress);
      const summary = activeTransaction.preview();
      transactionPreview.value = summary;
      transactionState.value = 'previewing';
      fsm.transition('previewing');
    } catch (err) {
      timelineError.value = String(err);
    }
  });

  bus.on('timeline:apply', async () => {
    if (!activeTransaction || transactionState.value !== 'previewing') {
      timelineError.value = 'No transaction to apply';
      return;
    }

    timelineError.value = null;
    transactionState.value = 'applying';
    fsm.transition('applying');

    try {
      const result = await activeTransaction.execute();
      undoStack.value = result.undoEntries || [];
      applyProgress.value = { current: result.executed, total: result.executed, label: 'Complete' };
      transactionState.value = 'applied';
      fsm.transition('applied');
    } catch (err) {
      const msg = String(err);
      timelineError.value = msg;
      transactionState.value = 'failed';
      fsm.transition('failed');
      const cat = categorizeError(err);
      if (cat === 'backend' || cat === 'premiere') addToast(msg, cat);
    }
  });

  bus.on('timeline:rollback', async () => {
    if (!activeTransaction) {
      timelineError.value = 'No transaction to rollback';
      return;
    }

    try {
      await activeTransaction.rollback();
      transactionState.value = 'rolled-back';
      fsm.transition('rolled-back');
      undoStack.value = [];
      applyProgress.value = null;
    } catch (err) {
      const msg = `Rollback failed: ${err}`;
      timelineError.value = msg;
      addToast(msg, 'premiere');
    }
  });

  return { fsm };
}
