/**
 * ProgressPanel — pipeline progress with stage dots, ETA, cost.
 * UXP Spectrum: sp-progress-bar, sp-button. No sp-help-text.
 */
import { h } from 'preact';
import { stage, percent, eta, cost, pipelineError } from '../signals.js';

const DISPLAY_STAGES = [
  { key: 'transcription', label: 'Transcription' },
  { key: 'analysis', label: 'Analysis' },
  { key: 'scoring', label: 'Scoring' },
  { key: 'packaging', label: 'Packaging' },
  { key: 'complete', label: 'Complete' },
];

function stageColor(stageKey, currentKey) {
  const stageOrder = DISPLAY_STAGES.map(s => s.key);
  const currentIdx = stageOrder.indexOf(currentKey);
  const stageIdx = stageOrder.indexOf(stageKey);

  if (stageIdx < currentIdx) return '#4caf50'; // completed — green
  if (stageIdx === currentIdx) return '#2196f3'; // current — blue
  return '#555'; // upcoming — gray
}

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

export function ProgressPanel({ bus }) {
  const currentStage = stage.value;
  const error = pipelineError.value;

  return (
    <div style="padding:16px;display:flex;flex-direction:column;gap:16px">
      <h3 style="color:#e0e0e0;margin:0;font-size:14px">Analyzing...</h3>

      <div style="display:flex;flex-direction:row;gap:8px;align-items:center;justify-content:center" role="progressbar" aria-label="Pipeline stages">
        {DISPLAY_STAGES.map(s => (
          <div key={s.key} style="display:flex;flex-direction:column;align-items:center;gap:4px">
            <span style={`display:inline-block;width:10px;height:10px;border-radius:50%;background:${stageColor(s.key, currentStage)}`} />
            <span style={`font-size:9px;color:${stageColor(s.key, currentStage) === '#555' ? '#666' : '#ccc'};white-space:nowrap`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <sp-progress-bar value={percent.value} max={100} style="width:100%" />

      <div style="display:flex;flex-direction:row;gap:16px;justify-content:center">
        {eta.value != null && (
          <span style="color:#999;font-size:12px">{formatEta(eta.value)}</span>
        )}
        <span style="color:#999;font-size:12px">Cost: {formatCost(cost.value)}</span>
      </div>

      {error && (
        <div style="color:#ff4444;font-size:12px;text-align:center">{error}</div>
      )}

      <sp-button
        variant="secondary"
        style="width:100%;margin-top:4px"
        onClick={() => bus.emit('pipeline:cancel', {})}
      >
        Cancel
      </sp-button>
    </div>
  );
}
