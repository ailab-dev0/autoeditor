import { h, render } from 'preact';
import { createEventBus } from '../../shared/event-bus';
import { createTransport } from '../../shared/transport';

let bus = null;
let transport = null;

function TranscriptView() {
  return (
    <div class="flex-col gap-md p-md">
      <h2>Transcript Panel</h2>
      <p class="text-muted">Transcript view — coming soon</p>
    </div>
  );
}

export function show() {
  bus = createEventBus();
  transport = createTransport(bus);
  render(<TranscriptView />, document.getElementById('root'));
}

export function hide() {
  transport?.disconnect();
  bus?.clear();
  render(null, document.getElementById('root'));
  bus = null;
  transport = null;
}
