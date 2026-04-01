/**
 * Shell — top-level Preact component for the main panel.
 * Dark background, full height. Renders Router + StatusBar.
 */
import { h } from 'preact';
import { Router } from './router.jsx';
import { StatusBar } from './status-bar';
import { shellContext } from './fsm';
import { handleKeyDown } from '../shared/keyboard.js';

export function Shell({ bus, transport }) {
  const projectId = shellContext.value?.projectId || null;

  return (
    <div
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style="display:flex;flex-direction:column;min-height:100vh;background:#1e1e1e;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;outline:none"
    >
      <div style="flex:1;overflow:auto">
        <Router bus={bus} transport={transport} projectId={projectId} />
      </div>
      <StatusBar />
    </div>
  );
}
