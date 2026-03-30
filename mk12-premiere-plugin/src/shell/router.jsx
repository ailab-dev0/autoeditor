/**
 * Router — maps shell FSM state to domain components.
 * Reads shellState signal and renders the appropriate view.
 */
import { h } from 'preact';
import { shellState, STATES } from './fsm';

// Placeholder components — replaced when domain modules are built
function LoginForm() {
  return <div class="p-md">Login</div>;
}

function ServerConnect() {
  return (
    <div class="p-md flex-col gap-sm">
      <sp-progress-bar indeterminate label="Connecting..." />
      <span class="text-muted">Connecting...</span>
    </div>
  );
}

function ProjectSelector() {
  return <div class="p-md">Select Project</div>;
}

function ProgressPanel() {
  return <div class="p-md">Pipeline Running</div>;
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

export function Router() {
  const View = STATE_VIEWS[shellState.value];
  return View ? <View /> : null;
}
