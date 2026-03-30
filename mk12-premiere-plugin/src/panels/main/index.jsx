import { h, render } from 'preact';
import { createEventBus } from '../../shared/event-bus';
import { createTransport } from '../../shared/transport';
import { createMockTransport } from '../../shared/mock-transport';
import { createShellFsm } from '../../shell/fsm';
import { setupAuthAdapter } from '../../domains/auth/adapter';
import { setupPipelineAdapter } from '../../domains/pipeline/adapter';
import { setupSegmentsAdapter } from '../../domains/segments/adapter';
import { setupTimelineAdapter } from '../../domains/timeline/adapter';
import { Shell } from '../../shell/Shell';

let bus = null;
let transport = null;
let fsm = null;

function isDevMode() {
  try { return localStorage.getItem('editorlens-dev') === 'true'; } catch { return false; }
}

export function show() {
  bus = createEventBus();
  transport = isDevMode() ? createMockTransport(bus) : createTransport(bus);
  fsm = createShellFsm(bus);

  // Wire domain adapters
  setupAuthAdapter(bus, transport);
  setupPipelineAdapter(bus, transport);
  setupSegmentsAdapter(bus, transport);
  setupTimelineAdapter(bus, transport);

  render(<Shell bus={bus} />, document.getElementById('root'));

  if (isDevMode()) {
    console.log('[EditorLens] Dev mode — using mock transport');
  }
}

export function hide() {
  transport?.disconnect();
  bus?.clear();
  render(null, document.getElementById('root'));
  bus = null;
  transport = null;
  fsm = null;
}
