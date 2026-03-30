/**
 * Router — maps shell FSM state to domain components.
 * Reads shellState signal and renders the appropriate view.
 */
import { h } from 'preact';
import { shellState, STATES } from './fsm';
import { LoginForm } from '../domains/auth/components/LoginForm.jsx';
import { ServerConnect } from '../domains/auth/components/ServerConnect.jsx';
import { ProgressPanel } from '../domains/pipeline/components/ProgressPanel.jsx';

// Placeholders — replaced when domain modules are built
function ProjectSelector() {
  return <div class="p-md">Select Project</div>;
}

function SegmentList() {
  return <div class="p-md">Review Segments</div>;
}

function ApplySummary() {
  return <div class="p-md">Applying Edits</div>;
}

const STATE_VIEWS = {
  [STATES.UNAUTHENTICATED]: LoginForm,
  [STATES.CONNECTING]: ServerConnect,
  [STATES.READY]: ProjectSelector,
  [STATES.WORKING]: ProgressPanel,
  [STATES.REVIEWING]: SegmentList,
  [STATES.APPLYING]: ApplySummary,
};

export function Router({ bus }) {
  const View = STATE_VIEWS[shellState.value];
  return View ? <View bus={bus} /> : null;
}
