/**
 * TranscriptView — scrollable transcript segments with export buttons.
 * UXP: sp-button. Inline styles for dark theme.
 */
import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { transcript, transcriptError, exportFormat } from '../signals';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TranscriptView({ bus, projectId }) {
  useEffect(() => {
    if (projectId) bus.emit('transcript:fetch', { projectId });
  }, [projectId, bus]);

  const data = transcript.value;
  const error = transcriptError.value;

  return (
    <div style="display:flex;flex-direction:column;height:100%;padding:10px;gap:10px">
      {error && <div style="color:#ff4444;font-size:12px">{error}</div>}

      {!data && !error && (
        <div style="color:#666;font-size:12px;text-align:center;padding:16px">
          {projectId ? 'Loading transcript...' : 'No transcript loaded'}
        </div>
      )}

      {data && (
        <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:2px">
          {data.segments && data.segments.length > 0 ? (
            data.segments.map((seg, i) => (
              <div key={seg.id || i} style="display:flex;flex-direction:row;gap:10px;padding:6px 4px;border-bottom:1px solid #2a2a2a">
                <span style="font-family:monospace;font-size:11px;color:#666;min-width:55px;flex-shrink:0">
                  {formatTime(seg.start)}
                </span>
                <span style="font-size:12px;color:#ccc;line-height:1.4">{seg.text}</span>
              </div>
            ))
          ) : (
            <div style="font-size:12px;color:#ccc;line-height:1.5;white-space:pre-wrap">{data.text}</div>
          )}
        </div>
      )}

      <div style="display:flex;flex-direction:row;gap:6px;padding-top:6px;border-top:1px solid #333">
        {['srt', 'json', 'txt'].map(fmt => {
          const active = exportFormat.value === fmt;
          return (
            <sp-button
              key={fmt}
              variant={active ? 'accent' : 'secondary'}
              size="s"
              style="flex:1;text-transform:uppercase;font-size:11px"
              onClick={() => {
                exportFormat.value = fmt;
                bus.emit('transcript:fetch', { format: fmt, projectId });
              }}
            >
              {fmt}
            </sp-button>
          );
        })}
      </div>
    </div>
  );
}
