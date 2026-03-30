/**
 * ApplySummary — post-apply view showing operation counts, status, rollback.
 */
import { h } from 'preact';
import {
  transactionPreview, applyProgress, timelineError,
  canRollback, transactionState,
} from '../signals.js';

function OpCount({ label, count }) {
  if (!count) return null;
  return <span class="text-sm">{count} {label}</span>;
}

export function ApplySummary({ bus }) {
  const preview = transactionPreview.value;
  const progress = applyProgress.value;
  const error = timelineError.value;
  const state = transactionState.value;
  const showRollback = canRollback.value;

  const counts = preview?.opCounts || {};

  return (
    <div class="flex-col gap-md p-md">
      <h3 class="text-md">
        {state === 'applied' ? 'Edits Applied' : state === 'failed' ? 'Apply Failed' : 'Apply Summary'}
      </h3>

      <div class="flex-row gap-md" style="flex-wrap: wrap;">
        <OpCount label="removed" count={counts.remove_clip} />
        <OpCount label="trimmed" count={counts.trim_clip} />
        <OpCount label="speed changed" count={counts.set_speed} />
        <OpCount label="moved" count={counts.move_clip} />
        <OpCount label="inserted" count={counts.insert_clip} />
        <OpCount label="transitions" count={counts.insert_transition} />
        <OpCount label="markers" count={counts.add_marker} />
      </div>

      {progress && (
        <span class="text-muted text-sm">
          {progress.current}/{progress.total} operations — {progress.label}
        </span>
      )}

      {error && (
        <sp-help-text variant="negative">{error}</sp-help-text>
      )}

      {showRollback && (
        <sp-button
          variant="negative"
          onClick={() => bus && bus.emit('timeline:rollback', {})}
        >
          Rollback
        </sp-button>
      )}
    </div>
  );
}
