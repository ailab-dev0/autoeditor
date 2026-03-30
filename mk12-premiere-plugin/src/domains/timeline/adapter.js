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
import { toTimelineOperations } from '../segments/protocol.js';

export function setupTimelineAdapter(bus, transport) {
  const fsm = createTimelineFsm(bus);
  let activeTransaction = null;

  bus.on('timeline:preview', () => {
    timelineError.value = null;

    const ops = toTimelineOperations(segments.value, approvals.value);
    if (ops.length === 0) {
      timelineError.value = 'No approved segments to apply';
      return;
    }

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
      timelineError.value = String(err);
      transactionState.value = 'failed';
      fsm.transition('failed');
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
      timelineError.value = `Rollback failed: ${err}`;
    }
  });

  return { fsm };
}
