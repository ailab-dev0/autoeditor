/**
 * StatusBar — persistent footer showing connection state, review progress, and keyboard hint.
 * UXP compatible: uses inline styles, no sp-status-light.
 */
import { h } from 'preact';
import { connectionState, reconnectAttempt } from '../shared/transport';
import { toastCount } from '../shared/errors';
import { shellState, STATES } from './fsm';
import { stats } from '../domains/segments/signals.js';

const STATUS_CONFIG = {
  connected: { color: '#4caf50', label: 'Connected' },
  connecting: { color: '#ff9800', label: 'Connecting...' },
  reconnecting: { color: '#ff9800', label: 'Reconnecting...' },
  disconnected: { color: '#f44336', label: 'Disconnected' },
};

export function StatusBar() {
  const state = connectionState.value;
  const attempt = reconnectAttempt.value;
  const count = toastCount.value;
  const cfg = STATUS_CONFIG[state] || STATUS_CONFIG.disconnected;
  const label = state === 'reconnecting' ? `Reconnecting (${attempt})...` : cfg.label;

  const isReviewing = shellState.value === STATES.REVIEWING;
  const st = stats.value;
  const reviewed = st.approvedCount + st.rejectedCount;
  const total = st.total;
  const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  return (
    <div style="display:flex;flex-direction:row;align-items:center;padding:4px 12px;border-top:1px solid #333;min-height:24px">
      <div style="display:flex;flex-direction:row;align-items:center;gap:6px">
        <span style={`display:inline-block;width:8px;height:8px;border-radius:50%;background:${cfg.color}`} />
        <span style="color:#999;font-size:11px">{label}</span>
      </div>
      {count > 0 && (
        <span style="background:#f44336;color:#fff;font-size:10px;padding:1px 6px;border-radius:8px;min-width:16px;text-align:center;margin-left:8px">
          {count}
        </span>
      )}
      <div style="margin-left:auto;display:flex;flex-direction:row;align-items:center;gap:8px">
        {isReviewing && total > 0 && (
          <div style="display:flex;flex-direction:row;align-items:center;gap:6px">
            <span style="color:#999;font-size:11px">{reviewed}/{total} reviewed</span>
            <div style="width:60px;height:3px;background:#333;border-radius:2px;overflow:hidden">
              <div style={`width:${pct}%;height:100%;background:#4dabf7;border-radius:2px`} />
            </div>
            <span style="color:#999;font-size:11px">{pct}%</span>
          </div>
        )}
        <span style="font-size:8px;font-family:monospace;background:#666;color:#999;padding:1px 4px;border-radius:2px;user-select:none">? help</span>
      </div>
    </div>
  );
}
