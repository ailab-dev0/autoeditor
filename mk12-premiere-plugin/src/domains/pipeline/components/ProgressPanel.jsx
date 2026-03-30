/**
 * ProgressPanel — pipeline progress display with stage dots, ETA, cost.
 */
import { h } from 'preact';
import { stage, percent, eta, cost, stageLabel, pipelineError, STAGES } from '../signals.js';

function formatEta(ms) {
  if (ms == null) return null;
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `~${min}m ${sec}s remaining`;
  return `~${sec}s remaining`;
}

function formatCost(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

const DISPLAY_STAGES = STAGES.filter(s => s !== 'idle');

export function ProgressPanel() {
  const currentStage = stage.value;
  const currentIdx = DISPLAY_STAGES.indexOf(currentStage);
  const error = pipelineError.value;

  return (
    <div class="flex-col gap-md p-md">
      <div class="flex-row gap-sm" role="progressbar" aria-label="Pipeline stages">
        {DISPLAY_STAGES.map((s, i) => (
          <span
            key={s}
            class={`stage-dot${i === currentIdx ? ' stage-dot--active' : ''}${i < currentIdx ? ' stage-dot--done' : ''}`}
            title={s}
          />
        ))}
      </div>

      <span class="text-md">{stageLabel.value}</span>

      <sp-progress-bar value={percent.value} max={100} label={`${percent.value}%`} />

      <div class="flex-row gap-lg">
        {eta.value != null && (
          <span class="text-muted text-sm">{formatEta(eta.value)}</span>
        )}
        <span class="text-muted text-sm">{formatCost(cost.value)}</span>
      </div>

      {error && (
        <sp-help-text variant="negative">{error}</sp-help-text>
      )}
    </div>
  );
}
