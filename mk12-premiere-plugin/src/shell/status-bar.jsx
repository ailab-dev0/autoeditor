/**
 * StatusBar — persistent footer showing connection state + toast badge.
 */
import { h } from 'preact';
import { connectionState, reconnectAttempt } from '../shared/transport';
import { toastCount } from '../shared/errors';

function Dot({ color, pulse }) {
  return (
    <span
      class={`status-dot status-dot--${color}${pulse ? ' status-dot--pulse' : ''}`}
    />
  );
}

function ConnectionIndicator() {
  const state = connectionState.value;
  const attempt = reconnectAttempt.value;

  switch (state) {
    case 'connected':
      return <span class="flex-row gap-sm"><Dot color="positive" />Connected</span>;
    case 'connecting':
      return <span class="flex-row gap-sm"><Dot color="notice" pulse />Connecting...</span>;
    case 'reconnecting':
      return (
        <span class="flex-row gap-sm">
          <Dot color="notice" pulse />Reconnecting (attempt {attempt})...
        </span>
      );
    case 'disconnected':
    default:
      return <span class="flex-row gap-sm"><Dot color="negative" />Disconnected</span>;
  }
}

export function StatusBar() {
  const count = toastCount.value;

  return (
    <div class="status-bar flex-row gap-md p-sm">
      <ConnectionIndicator />
      {count > 0 && (
        <span class="status-bar__toast-badge">{count}</span>
      )}
    </div>
  );
}
