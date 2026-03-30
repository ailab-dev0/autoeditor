/**
 * ServerConnect — connecting screen with cancel option.
 * UXP Spectrum: sp-progress-bar, sp-button.
 */
import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { serverUrl } from '../signals.js';

export function ServerConnect({ bus }) {
  useEffect(() => {
    bus.emit('health:check', {});
  }, [bus]);

  return (
    <div style="padding:16px;display:flex;flex-direction:column;gap:16px;align-items:center;justify-content:center;min-height:200px">
      <div style="color:#e0e0e0;font-size:14px;text-align:center">Connecting to server...</div>
      <sp-progress-bar indeterminate style="width:100%;max-width:280px" />
      <div style="color:#999;font-size:12px;text-align:center">{serverUrl.value}</div>
      <sp-button
        variant="secondary"
        style="margin-top:8px"
        onClick={() => bus.emit('auth:logout', {})}
      >
        Cancel
      </sp-button>
    </div>
  );
}
