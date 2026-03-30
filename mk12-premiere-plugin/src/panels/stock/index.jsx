import { h, render } from 'preact';
import { createEventBus } from '../../shared/event-bus';
import { createTransport } from '../../shared/transport';
import { setupStockAdapter } from '../../domains/stock/adapter';
import { StockBrowser } from '../../domains/stock/components/StockBrowser';

let bus = null;
let transport = null;

export function show() {
  bus = createEventBus();
  transport = createTransport(bus);
  setupStockAdapter(bus, transport);
  render(<StockBrowser bus={bus} />, document.getElementById('root'));
}

export function hide() {
  transport?.disconnect();
  bus?.clear();
  render(null, document.getElementById('root'));
  bus = null;
  transport = null;
}
