import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { stage, percent, eta, cost, pipelineError, pipelineLog } from '../signals.js';

const STAGES = [
  { key: 'transcription', label: 'Trans' },
  { key: 'analysis',      label: 'Flow' },
  { key: 'scoring',       label: 'Chap' },
  { key: 'packaging',     label: 'Prod' },
];

const STAGE_ORDER = STAGES.map((s) => s.key);

function stageStatus(stageKey, currentStage) {
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  const thisIdx = STAGE_ORDER.indexOf(stageKey);
  if (thisIdx < 0 || currentIdx < 0) return 'pending';
  if (currentStage === 'complete') return 'done';
  if (thisIdx < currentIdx) return 'done';
  if (thisIdx === currentIdx) return 'current';
  return 'pending';
}

function dotColor(status) {
  if (status === 'done') return '#4caf50';
  if (status === 'current') return '#4dabf7';
  return '#666';
}

function formatEta(ms) {
  if (!ms || ms <= 0) return '--';
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatCost(cents) {
  if (!cents) return '$0.00';
  return `$${(cents / 100).toFixed(2)}`;
}

function logIcon(entry) {
  if (entry.status === 'done') return '\u2705';
  if (entry.status === 'current') return '\u2192';
  return '\u00b7';
}

function logColor(entry) {
  if (entry.status === 'done') return '#4caf50';
  if (entry.status === 'current') return '#4dabf7';
  return '#666';
}

export function ProgressPanel({ bus }) {
  const logEndRef = useRef(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView?.({ behavior: 'smooth' });
    }
  }, [pipelineLog.value.length]);

  const currentStage = stage.value;
  const pct = percent.value;
  const error = pipelineError.value;
  const logs = pipelineLog.value;

  const handleCancel = () => bus.emit('pipeline:cancel', {});

  return (
    h('div', {
      style: `
        display: flex;
        height: 100%;
        background: #1e1e1e;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #e0e0e0;
      `
    },
      // LEFT SIDE
      h('div', {
        style: `
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 16px 12px;
          gap: 14px;
        `
      },
        // Title
        h('div', {
          style: `font-size: 16px; font-weight: bold;`
        }, error ? 'Error' : 'Analyzing...'),

        // Error display
        error && h('div', {
          style: `
            font-size: 11px;
            color: #ff4444;
            text-align: center;
            padding: 6px 10px;
            background: rgba(255, 68, 68, 0.1);
            border-radius: 4px;
            max-width: 200px;
            word-break: break-word;
          `
        }, error),

        // Stage dots row
        h('div', {
          style: `
            display: flex;
            gap: 16px;
            align-items: flex-start;
          `
        },
          STAGES.map((s) => {
            const status = stageStatus(s.key, currentStage);
            return h('div', {
              key: s.key,
              style: `
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
              `
            },
              h('div', {
                style: `
                  width: 10px;
                  height: 10px;
                  border-radius: 50%;
                  background: ${dotColor(status)};
                  ${status === 'current' ? 'box-shadow: 0 0 6px rgba(77, 171, 247, 0.5);' : ''}
                `
              }),
              h('span', {
                style: `font-size: 8px; color: #999;`
              }, s.label)
            );
          })
        ),

        // Progress bar
        h('div', {
          style: `
            width: 220px;
            height: 4px;
            background: #333;
            border-radius: 2px;
            overflow: hidden;
          `
        },
          h('div', {
            style: `
              width: ${pct}%;
              height: 100%;
              background: linear-gradient(90deg, #4dabf7, #74c0fc);
              border-radius: 2px;
              transition: width 0.3s ease;
            `
          })
        ),

        // Stage message
        h('div', {
          style: `font-size: 11px; color: #999;`
        }, currentStage === 'complete'
          ? 'Analysis complete'
          : `${pct}% \u2014 ${currentStage || 'preparing'}...`
        ),

        // Cancel button
        !error && currentStage !== 'complete' && h('button', {
          onClick: handleCancel,
          style: `
            font-size: 10px;
            padding: 4px 12px;
            background: transparent;
            color: #999;
            border: 1px solid #555;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 4px;
          `
        }, 'Cancel')
      ),

      // RIGHT SIDE
      h('div', {
        style: `
          flex: 1;
          display: flex;
          flex-direction: column;
          border-left: 1px solid #333;
        `
      },
        // Log header
        h('div', {
          style: `
            font-size: 10px;
            font-weight: 600;
            color: #999;
            padding: 8px 10px 6px;
            border-bottom: 1px solid #333;
          `
        }, 'Live Log'),

        // Log entries
        h('div', {
          style: `
            flex: 1;
            overflow-y: auto;
            padding: 6px 10px;
          `
        },
          logs.length === 0
            ? h('div', {
                style: `font-size: 9px; color: #555; padding: 8px 0;`
              }, 'Waiting for log entries...')
            : logs.map((entry, i) =>
                h('div', {
                  key: i,
                  style: `
                    font-size: 9px;
                    font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
                    color: ${logColor(entry)};
                    padding: 1px 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  `
                },
                  h('span', { style: `margin-right: 4px;` }, logIcon(entry)),
                  entry.message || entry.text || String(entry)
                )
              ),
          h('div', { ref: logEndRef })
        ),

        // Footer: ETA + Cost
        h('div', {
          style: `
            display: flex;
            justify-content: space-between;
            padding: 6px 10px;
            border-top: 1px solid #333;
            font-size: 9px;
            color: #999;
          `
        },
          h('span', null, `ETA: ${formatEta(eta.value)}`),
          h('span', null, `Cost: ${formatCost(cost.value)}`)
        )
      )
    )
  );
}
