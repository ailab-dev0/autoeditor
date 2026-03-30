import { h } from 'preact';
import { transcript, transcriptError, exportFormat } from '../signals';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TranscriptView({ bus }) {
  const data = transcript.value;

  if (!data) {
    return (
      <div class="flex-col gap-md p-md">
        <p class="text-muted">No transcript loaded.</p>
        {transcriptError.value && (
          <sp-help-text variant="negative">{transcriptError.value}</sp-help-text>
        )}
      </div>
    );
  }

  return (
    <div class="flex-col gap-md p-md">
      <div class="transcript-segments" style="flex:1;overflow-y:auto">
        {(data.segments || []).map((seg, i) => (
          <div key={i} class="flex-row gap-sm p-sm" style="border-bottom:1px solid var(--spectrum-global-color-gray-300,#444)">
            <span class="text-muted" style="font-size:11px;min-width:48px;font-family:monospace">
              {formatTime(seg.start)}
            </span>
            <span style="flex:1">{seg.text}</span>
          </div>
        ))}
      </div>

      <div class="flex-row gap-sm" style="padding-top:8px;border-top:1px solid var(--spectrum-global-color-gray-300,#444)">
        <sp-action-group compact>
          {['srt', 'json', 'txt'].map(fmt => (
            <sp-action-button
              key={fmt}
              selected={exportFormat.value === fmt ? '' : undefined}
              onClick={() => { exportFormat.value = fmt; }}
            >
              {fmt.toUpperCase()}
            </sp-action-button>
          ))}
        </sp-action-group>
        <sp-button
          variant="primary"
          onClick={() => bus.emit('transcript:fetch', { format: exportFormat.value })}
        >
          Export
        </sp-button>
      </div>
    </div>
  );
}
