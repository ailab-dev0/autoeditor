/**
 * StatusBar — persistent footer showing connection state + toast badge.
 * UXP compatible: uses inline styles, no sp-status-light.
 */
import { h } from 'preact';
import { connectionState, reconnectAttempt } from '../shared/transport';
import { toastCount } from '../shared/errors';

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

  return (
    <div style="display:flex;flex-direction:row;align-items:center;justify-content:space-between;padding:4px 12px;border-top:1px solid #333;min-height:24px">
      <div style="display:flex;flex-direction:row;align-items:center;gap:6px">
        <span style={`display:inline-block;width:8px;height:8px;border-radius:50%;background:${cfg.color}`} />
        <span style="color:#999;font-size:11px">{label}</span>
      </div>
      {count > 0 && (
        <span style="background:#f44336;color:#fff;font-size:10px;padding:1px 6px;border-radius:8px;min-width:16px;text-align:center">
          {count}
        </span>
      )}
    </div>
  );
}
