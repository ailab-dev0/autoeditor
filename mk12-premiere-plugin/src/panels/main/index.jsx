import { h, render } from 'preact';
import '../../shared/styles/utilities.css';
import { entrypoints } from 'uxp';
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
let root = null;
let attachment = null;

function isDevMode() {
  try { return localStorage.getItem('editorlens-dev') === 'true'; } catch { return false; }
}

function initApp() {
  if (bus) return; // already initialized
  bus = createEventBus();
  transport = isDevMode() ? createMockTransport(bus) : createTransport(bus);
  fsm = createShellFsm(bus);

  setupAuthAdapter(bus, transport);
  setupPipelineAdapter(bus, transport);
  setupSegmentsAdapter(bus, transport);
  setupTimelineAdapter(bus, transport);
  setupStockAdapter(bus, transport);
  setupTranscriptAdapter(bus, transport);
  setupExportAdapter(bus, transport);
  setupKnowledgeAdapter(bus, transport);

  if (isDevMode()) {
    console.log('[EditorLens] Dev mode — using mock transport');
  }
}

function teardownApp() {
  if (root) {
    render(null, root);
  }
  transport?.disconnect?.();
  bus?.destroy?.();
  bus = null;
  transport = null;
  fsm = null;
  root = null;
  attachment = null;
}

const mainPanelController = {
  create() {
    root = document.createElement('div');
    root.style.height = '100vh';
    root.style.overflow = 'auto';

    initApp();
    render(<Shell bus={bus} />, root);

    return root;
  },

  show(event) {
    if (!root) this.create();
    attachment = event;
    attachment.appendChild(root);
  },

  hide() {
    if (attachment && root) {
      attachment.removeChild(root);
      attachment = null;
    }
  },

  destroy() {
    teardownApp();
  }
};

entrypoints.setup({
  plugin: {
    create() { console.log('[EditorLens v2] Plugin created'); },
    destroy() { console.log('[EditorLens v2] Plugin destroyed'); }
  },
  panels: {
    'editorlens.main': mainPanelController
  }
});
