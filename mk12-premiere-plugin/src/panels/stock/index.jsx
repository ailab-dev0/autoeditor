import { h, render } from 'preact';
import { entrypoints } from 'uxp';
import { createEventBus } from '../../shared/event-bus';
import { createTransport } from '../../shared/transport';
import { setupStockAdapter } from '../../domains/stock/adapter';
import { StockBrowser } from '../../domains/stock/components/StockBrowser';

let bus = null;
let transport = null;
let root = null;
let attachment = null;

const stockPanelController = {
  create() {
    root = document.createElement('div');
    root.style.height = '100vh';
    root.style.overflow = 'auto';

    bus = createEventBus();
    transport = createTransport(bus);
    setupStockAdapter(bus, transport);
    render(<StockBrowser bus={bus} />, root);

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
    'editorlens.stock': stockPanelController
  }
});
