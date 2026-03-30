import { h, render } from 'preact';
import { createEventBus } from '../../shared/event-bus';
import { createTransport } from '../../shared/transport';
import { createMockTransport } from '../../shared/mock-transport';
import { createShellFsm } from '../../shell/fsm';
import { setupAuthAdapter } from '../../domains/auth/adapter';
import { setupPipelineAdapter } from '../../domains/pipeline/adapter';
import { setupSegmentsAdapter } from '../../domains/segments/adapter';
import { setupTimelineAdapter } from '../../domains/timeline/adapter';
import { setupStockAdapter } from '../../domains/stock/adapter';
import { setupTranscriptAdapter } from '../../domains/transcript/adapter';
import { setupExportAdapter } from '../../domains/export/adapter';
import { setupKnowledgeAdapter } from '../../domains/knowledge/adapter';
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
  setupStockAdapter(bus, transport);
  setupTranscriptAdapter(bus, transport);
  setupExportAdapter(bus, transport);
  setupKnowledgeAdapter(bus, transport);

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
