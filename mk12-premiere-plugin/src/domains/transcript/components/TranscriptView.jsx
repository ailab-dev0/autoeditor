import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { transcript, transcriptError, exportFormat } from '../signals.js';

function formatTime(seconds) {
  if (seconds == null) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function totalWords(segments) {
  if (!segments) return 0;
  return segments.reduce((sum, seg) => sum + (seg.text || '').split(/\s+/).filter(Boolean).length, 0);
}

function totalDuration(segments) {
  if (!segments || segments.length === 0) return 0;
  const last = segments[segments.length - 1];
  return last.end || 0;
}

export function TranscriptView({ bus, projectId }) {
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (projectId) {
      bus.emit('transcript:fetch', { projectId });
    }
  }, [projectId]);

  const data = transcript.value;
  const error = transcriptError.value;

  const handleExport = (fmt) => {
    exportFormat.value = fmt;
    bus.emit('transcript:fetch', { projectId, format: fmt });
  };

  const handleLineClick = (seg) => {
    setSelectedId(seg.id);
    bus.emit('transcript:seek', { time: seg.start });
  };

  // Error state
  if (error) {
    return h('div', {
      style: `
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        background: #1e1e1e;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `
    },
      h('div', {
        style: `
          font-size: 11px;
          color: #ff4444;
          text-align: center;
          padding: 6px 10px;
          background: rgba(255, 68, 68, 0.1);
          border-radius: 4px;
        `
      }, error)
    );
  }

  // Loading / empty state
  if (!data) {
    return h('div', {
      style: `
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        background: #1e1e1e;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #666;
        font-size: 11px;
      `
    }, 'No transcript loaded');
  }

  const segs = data.segments || [];
  const words = totalWords(segs);
  const duration = totalDuration(segs);

  return (
    h('div', {
      style: `
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #1e1e1e;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #e0e0e0;
      `
    },
      // Scrollable transcript lines
      h('div', {
        style: `
          flex: 1;
          overflow-y: auto;
          padding: 6px 10px;
        `
      },
        segs.length === 0
          ? h('div', {
              style: `font-size: 11px; color: #666; text-align: center; padding: 20px;`
            }, 'No segments')
          : segs.map((seg, i) => {
              const isSelected = selectedId === seg.id;
              const isCut = seg.suggestion === 'cut' || seg.cut;

              return h('div', {
                key: seg.id || i,
                onClick: () => handleLineClick(seg),
                style: `
                  display: flex;
                  gap: 8px;
                  padding: 3px 6px;
                  border-radius: 3px;
                  cursor: pointer;
                  background: ${isSelected ? '#1a3a5c' : 'transparent'};
                  ${isCut ? 'opacity: 0.35;' : ''}
                `
              },
                // Timecode
                h('span', {
                  style: `
                    font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
                    font-size: 10px;
                    color: ${isSelected ? '#4dabf7' : '#666'};
                    min-width: 38px;
                    flex-shrink: 0;
                  `
                }, formatTime(seg.start)),

                // Text
                h('span', {
                  style: `
                    font-size: 11px;
                    color: #ccc;
                    line-height: 1.4;
                    ${isCut ? 'text-decoration: line-through;' : ''}
                  `
                }, seg.text || ''),

                // Cut badge
                isCut && h('span', {
                  style: `
                    font-size: 8px;
                    font-weight: 600;
                    color: #ff4444;
                    background: rgba(255, 68, 68, 0.15);
                    padding: 1px 4px;
                    border-radius: 3px;
                    flex-shrink: 0;
                    align-self: center;
                  `
                }, 'CUT')
              );
            })
      ),

      // Speaker info bar
      h('div', {
        style: `
          padding: 6px 10px;
          border-top: 1px solid #333;
          font-size: 9px;
          color: #999;
        `
      }, `Speaker A \u2022 ${segs.length} segs \u2022 ${words} words \u2022 ${formatTime(duration)}`),

      // Export buttons
      h('div', {
        style: `
          display: flex;
          gap: 4px;
          padding: 6px 10px 8px;
          border-top: 1px solid #333;
        `
      },
        ['srt', 'json', 'txt'].map((fmt) =>
          h('button', {
            key: fmt,
            onClick: () => handleExport(fmt),
            style: `
              flex: 1;
              font-size: 10px;
              font-weight: 600;
              padding: 4px 0;
              background: ${fmt === 'srt' ? '#4dabf7' : 'transparent'};
              color: ${fmt === 'srt' ? '#fff' : '#999'};
              border: 1px solid ${fmt === 'srt' ? '#4dabf7' : '#444'};
              border-radius: 4px;
              cursor: pointer;
              text-transform: uppercase;
            `
          }, fmt)
        )
      )
    )
  );
}
