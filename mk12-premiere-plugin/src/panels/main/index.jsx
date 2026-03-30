import { h, render } from 'preact';
import { createEventBus } from '../../shared/event-bus';
import { createTransport } from '../../shared/transport';
import { createShellFsm } from '../../shell/fsm';
import { Shell } from '../../shell/Shell';

let bus = null;
let transport = null;
let fsm = null;

export function show() {
  bus = createEventBus();
  transport = createTransport(bus);
  fsm = createShellFsm(bus);
  render(<Shell bus={bus} />, document.getElementById('root'));
}

export function hide() {
  transport?.disconnect();
  bus?.clear();
  render(null, document.getElementById('root'));
  bus = null;
  transport = null;
  fsm = null;
}
