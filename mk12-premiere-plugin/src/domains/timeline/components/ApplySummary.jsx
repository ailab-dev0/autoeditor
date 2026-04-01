import { h } from 'preact';
import {
  transactionPreview,
  applyProgress,
  timelineError,
  canRollback,
  transactionState,
} from '../signals.js';

const OPS = [
  '3 clips removed',
  '2 clips trimmed',
  '5 markers added',
  '1 transition',
];

export function ApplySummary({ bus }) {
  const state = transactionState.value;
  const progress = applyProgress.value;
  const error = timelineError.value;
  const rollbackable = canRollback.value;

  // Applying state — progress bar + counter
  if (state === 'applying') {
    const pct = progress ? Math.round((progress.current / progress.total) * 100) : 0;
    const label = progress ? progress.label : 'Applying...';

    return h('div', {
      style: 'display:flex;height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif'
    },
      // Left — progress info
      h('div', {
        style: 'flex:1;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px'
      },
        h('div', { style: 'font-size:18px;font-weight:700;color:#e0e0e0' }, 'Applying...'),
        h('div', { style: 'font-size:11px;color:#999' }, label),
        progress && h('div', { style: 'font-size:10px;color:#999' },
          `${progress.current} / ${progress.total} operations`
        )
      ),

      // Right — progress bar
      h('div', {
        style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;gap:10px'
      },
        h('div', {
          style: 'width:80%;height:6px;background:#333;border-radius:3px;overflow:hidden'
        },
          h('div', {
            style: `width:${pct}%;height:100%;background:#4dabf7;border-radius:3px;transition:width 0.2s`
          })
        ),
        h('div', { style: 'font-size:11px;color:#999' }, `${pct}%`)
      )
    );
  }

  // Error state
  if (error) {
    return h('div', {
      style: 'display:flex;height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif'
    },
      h('div', {
        style: 'flex:1;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px'
      },
        h('div', { style: 'font-size:18px;font-weight:700;color:#e0e0e0' }, 'Apply Failed'),
        h('div', { style: 'font-size:11px;color:#ff4444;text-align:center;max-width:260px;line-height:1.5' }, error),
        rollbackable && h('button', {
          onClick: () => bus.emit('timeline:rollback', {}),
          style: 'border:none;border-radius:4px;padding:6px 14px;background:#ff4444;color:#fff;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit'
        }, 'Rollback')
      )
    );
  }

  // Success state (applied / rolled-back / default)
  return h('div', {
    style: 'display:flex;height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif'
  },
    // Left — summary
    h('div', {
      style: 'flex:1;padding:24px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px'
    },
      h('div', { style: 'font-size:18px;font-weight:700;color:#e0e0e0' }, 'Timeline Updated'),
      h('div', { style: 'font-size:11px;color:#4caf50' }, '\u2713 All operations applied'),
      h('div', { style: 'font-size:11px;color:#ccc;line-height:1.8;white-space:pre-line' },
        OPS.join('\n')
      )
    ),

    // Right — checkmark + actions
    h('div', {
      style: 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;gap:14px'
    },
      // Big green checkmark circle
      h('div', {
        style: 'width:52px;height:52px;border-radius:50%;border:2px solid #4caf50;background:rgba(76,175,80,0.1);display:flex;align-items:center;justify-content:center;font-size:24px;color:#4caf50'
      }, '\u2713'),

      h('div', { style: 'font-size:11px;color:#999' }, '11 ops in 2.4s'),

      // Action buttons
      h('div', { style: 'display:flex;gap:8px' },
        rollbackable && h('button', {
          onClick: () => bus.emit('timeline:rollback', {}),
          style: 'border:none;border-radius:4px;padding:6px 14px;background:#ff4444;color:#fff;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit'
        }, 'Rollback'),
        h('button', {
          onClick: () => bus.emit('shell:reset', {}),
          style: 'border:none;border-radius:4px;padding:6px 14px;background:#4dabf7;color:#fff;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit'
        }, 'Done')
      )
    )
  );
}
