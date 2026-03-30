/**
 * ServerConnect — shows connection progress, emits health check on mount.
 */
import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { serverUrl } from '../signals.js';

export function ServerConnect({ bus }) {
  useEffect(() => {
    bus.emit('health:check', {});
  }, [bus]);

  return (
    <div class="flex-col gap-md p-md">
      <sp-progress-bar indeterminate label="Connecting..." />
      <span class="text-muted">Connecting to {serverUrl.value}...</span>
    </div>
  );
}
