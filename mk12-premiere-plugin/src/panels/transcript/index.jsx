import { h, render } from 'preact';
import { entrypoints } from 'uxp';
import { createEventBus } from '../../shared/event-bus';
import { createTransport } from '../../shared/transport';
import { setupTranscriptAdapter } from '../../domains/transcript/adapter';
import { TranscriptView } from '../../domains/transcript/components/TranscriptView';

let bus = null;
let transport = null;
let root = null;
let attachment = null;

const transcriptPanelController = {
  create() {
    root = document.createElement('div');
    root.style.height = '100vh';
    root.style.overflow = 'auto';

    bus = createEventBus();
    transport = createTransport(bus);
    setupTranscriptAdapter(bus, transport);
    render(<TranscriptView bus={bus} />, root);

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
    if (root) render(null, root);
    transport?.disconnect?.();
    bus?.destroy?.();
    bus = null;
    transport = null;
    root = null;
    attachment = null;
  }
};

entrypoints.setup({
  panels: {
    'editorlens.transcript': transcriptPanelController
  }
});
