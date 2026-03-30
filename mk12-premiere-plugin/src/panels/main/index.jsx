import { h, render } from 'preact';
import { createEventBus } from '../../shared/event-bus';
import { createTransport } from '../../shared/transport';

let bus = null;
let transport = null;

function Shell() {
  return (
    <div class="flex-col gap-md p-md">
      <h2>EditorLens</h2>
      <p class="text-muted">Main panel — v2</p>
    </div>
  );
}

export function show() {
  bus = createEventBus();
  transport = createTransport(bus);
  render(<Shell />, document.getElementById('root'));
}

export function hide() {
  transport?.disconnect();
  bus?.clear();
  render(null, document.getElementById('root'));
  bus = null;
  transport = null;
}
