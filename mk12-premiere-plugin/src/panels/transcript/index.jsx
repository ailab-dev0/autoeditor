import { h, render } from 'preact';
import { createEventBus } from '../../shared/event-bus';
import { createTransport } from '../../shared/transport';
import { setupTranscriptAdapter } from '../../domains/transcript/adapter';
import { TranscriptView } from '../../domains/transcript/components/TranscriptView';

let bus = null;
let transport = null;

export function show() {
  bus = createEventBus();
  transport = createTransport(bus);
  setupTranscriptAdapter(bus, transport);
  render(<TranscriptView bus={bus} />, document.getElementById('root'));
}

export function hide() {
  transport?.disconnect();
  bus?.clear();
  render(null, document.getElementById('root'));
  bus = null;
  transport = null;
}
