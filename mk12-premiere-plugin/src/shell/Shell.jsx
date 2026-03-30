/**
 * Shell — top-level Preact component for the main panel.
 * Dark background, full height. Renders Router + StatusBar.
 */
import { h } from 'preact';
import { Router } from './router.jsx';
import { StatusBar } from './status-bar';
import { shellContext } from './fsm';

export function Shell({ bus }) {
  const projectId = shellContext.value?.projectId || null;

  return (
    <div style="display:flex;flex-direction:column;min-height:100vh;background:#1e1e1e;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px">
      <div style="flex:1;overflow:auto">
        <Router bus={bus} projectId={projectId} />
      </div>
      <StatusBar />
    </div>
  );
}
