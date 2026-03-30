/**
 * ApplySummary — post-apply view showing operation counts, status, rollback.
 * UXP: sp-button, sp-progress-bar. No sp-help-text.
 */
import { h } from 'preact';
import {
  transactionPreview, applyProgress, timelineError,
  canRollback, transactionState,
} from '../signals.js';

function OpLine({ label, count }) {
  if (!count) return null;
  return <div style="color:#ccc;font-size:12px">{count} {label}</div>;
}

export function ApplySummary({ bus }) {
  const preview = transactionPreview.value;
  const progress = applyProgress.value;
  const error = timelineError.value;
  const state = transactionState.value;
  const showRollback = canRollback.value;
  const counts = preview?.opCounts || {};

  const isApplying = state === 'applying';
  const isApplied = state === 'applied';
  const isFailed = state === 'failed';

  return (
    <div style="padding:16px;display:flex;flex-direction:column;gap:12px">
      <h3 style="color:#e0e0e0;margin:0;font-size:14px">
        {isApplying ? 'Applying...' : isApplied ? 'Timeline Updated' : isFailed ? 'Apply Failed' : 'Apply Summary'}
      </h3>

      {isApplying && progress && (
        <sp-progress-bar value={progress.current} max={progress.total} style="width:100%" />
      )}

      {isApplying && progress && (
        <div style="color:#999;font-size:12px;text-align:center">
          {progress.current}/{progress.total} — {progress.label}
        </div>
      )}

      {!isApplying && (
        <div style="display:flex;flex-direction:column;gap:4px">
          <OpLine label="clips removed" count={counts.remove_clip} />
          <OpLine label="clips trimmed" count={counts.trim_clip} />
          <OpLine label="speed changed" count={counts.set_speed} />
          <OpLine label="clips moved" count={counts.move_clip} />
          <OpLine label="clips inserted" count={counts.insert_clip} />
          <OpLine label="transitions added" count={counts.insert_transition} />
          <OpLine label="markers added" count={counts.add_marker} />
        </div>
      )}

      {isApplied && (
        <div style="color:#4caf50;font-size:12px">All operations applied successfully.</div>
      )}

      {error && (
        <div style="color:#ff4444;font-size:12px">{error}</div>
      )}

      <div style="display:flex;flex-direction:row;gap:8px;margin-top:4px">
        {showRollback && (
          <sp-button
            variant="negative"
            style="flex:1"
            onClick={() => bus && bus.emit('timeline:rollback', {})}
          >
            Rollback
          </sp-button>
        )}
        {(isApplied || isFailed) && (
          <sp-button
            variant="accent"
            style="flex:1"
            onClick={() => bus && bus.emit('shell:reset', {})}
          >
            Done
          </sp-button>
        )}
      </div>
    </div>
  );
}
