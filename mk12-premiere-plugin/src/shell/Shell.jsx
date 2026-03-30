/**
 * Shell — top-level Preact component for the main panel.
 * Renders Router (FSM-driven view) + StatusBar.
 */
import { h } from 'preact';
import { Router } from './router.jsx';
import { StatusBar } from './status-bar';
import { shellContext } from './fsm';

export function Shell({ bus }) {
  const projectId = shellContext.value?.projectId || null;

  return (
    <div class="shell flex-col" style="min-height: 100vh;">
      <div class="shell__content" style="flex: 1;">
        <Router bus={bus} projectId={projectId} />
      </div>
      <StatusBar />
    </div>
  );
}
