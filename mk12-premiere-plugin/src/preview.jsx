/**
 * Browser preview — polished Premiere-like chrome with panel switching.
 * Mocks UXP/Premiere, renders panels in a simulated Premiere workspace.
 */
import { h, Fragment, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import './shared/styles/utilities.css';
import { createEventBus } from './shared/event-bus';
import { createMockTransport } from './shared/mock-transport';
import { createShellFsm, shellState, shellContext, STATES } from './shell/fsm';
import { segments as segmentsSignal, approvals as approvalsSignal } from './domains/segments/signals';
import { transcript as transcriptSignal } from './domains/transcript/signals';
import { graphData as knowledgeSignal } from './domains/knowledge/signals';
import { setupAuthAdapter } from './domains/auth/adapter';
import { setupPipelineAdapter } from './domains/pipeline/adapter';
import { setupSegmentsAdapter } from './domains/segments/adapter';
import { setupTimelineAdapter } from './domains/timeline/adapter';
import { setupStockAdapter } from './domains/stock/adapter';
import { setupTranscriptAdapter } from './domains/transcript/adapter';
import { setupExportAdapter } from './domains/export/adapter';
import { setupKnowledgeAdapter } from './domains/knowledge/adapter';
import { setupProjectLoader } from './domains/pipeline/project-loader';
import { Shell } from './shell/Shell';
import { StockBrowser } from './domains/stock/components/StockBrowser';
import { TranscriptView } from './domains/transcript/components/TranscriptView';

// Force dev mode
localStorage.setItem('editorlens-dev', 'true');

// Init app
const bus = createEventBus();
const transport = createMockTransport(bus);
const fsm = createShellFsm(bus);

setupAuthAdapter(bus, transport);
setupPipelineAdapter(bus, transport);
setupSegmentsAdapter(bus, transport);
setupTimelineAdapter(bus, transport);
setupStockAdapter(bus, transport);
setupTranscriptAdapter(bus, transport);
setupExportAdapter(bus, transport);
setupKnowledgeAdapter(bus, transport);
setupProjectLoader(bus, transport);

// Preview: seed ALL mock data whenever we enter REVIEWING state
// This bypasses the fragile pipeline:complete → segments adapter chain
const MOCK_SEGMENTS = [
  { id: 'seg-1', start: 0, end: 15, suggestion: 'keep', confidence: 0.95, explanation: 'Strong intro with clear hook — sets up the topic and grabs attention', videoPath: '/mock/video.mp4' },
  { id: 'seg-2', start: 15, end: 22, suggestion: 'cut', confidence: 0.88, explanation: 'Dead air and filler — "um, let me pull up my editor"', videoPath: '/mock/video.mp4' },
  { id: 'seg-3', start: 22, end: 40, suggestion: 'trim_start', confidence: 0.72, explanation: 'Slow ramp-up, first 3s are hesitation before useful content', videoPath: '/mock/video.mp4' },
  { id: 'seg-4', start: 40, end: 48, suggestion: 'keep', confidence: 0.91, explanation: 'Core explanation of project structure — high value content', videoPath: '/mock/video.mp4' },
  { id: 'seg-5', start: 48, end: 55, suggestion: 'review', confidence: 0.60, explanation: 'Uncertain — may contain key concept about auth, needs human review', videoPath: '/mock/video.mp4' },
  { id: 'seg-6', start: 55, end: 68, suggestion: 'keep', confidence: 0.93, explanation: 'Express middleware walkthrough — clear and well-paced', videoPath: '/mock/video.mp4' },
  { id: 'seg-7', start: 68, end: 74, suggestion: 'cut', confidence: 0.85, explanation: 'Repeated content from earlier section', videoPath: '/mock/video.mp4' },
  { id: 'seg-8', start: 74, end: 90, suggestion: 'trim_both', confidence: 0.78, explanation: 'Good content but starts and ends with pauses', videoPath: '/mock/video.mp4' },
];

const MOCK_TRANSCRIPT_DATA = {
  text: '',
  segments: [
    { id: 'ts-1', start: 0, end: 4.2, text: 'Hey everyone, welcome back to the channel.' },
    { id: 'ts-2', start: 4.2, end: 8.5, text: "Today we're going to build a REST API from scratch using Node.js and Express." },
    { id: 'ts-3', start: 8.5, end: 15.0, text: "By the end of this video, you'll have a fully working API with authentication, CRUD operations, and error handling." },
    { id: 'ts-4', start: 15.0, end: 18.3, text: 'Um... let me just pull up my editor here.' },
    { id: 'ts-5', start: 18.3, end: 22.0, text: "OK so... yeah, let's just skip that part actually." },
    { id: 'ts-6', start: 22.0, end: 28.7, text: 'Alright, so the first thing we need to do is set up our project structure.' },
    { id: 'ts-7', start: 28.7, end: 35.2, text: "I'm going to create a new directory, run npm init, and install Express and a few other dependencies." },
    { id: 'ts-8', start: 35.2, end: 40.0, text: "Let me walk you through the folder layout — we'll have routes, controllers, middleware, and models." },
    { id: 'ts-9', start: 40.0, end: 48.0, text: "Here's the project structure. Routes handle URL mapping, controllers have your business logic, middleware handles auth and validation." },
    { id: 'ts-10', start: 48.0, end: 55.0, text: "Now this next section is a bit tricky. I'm not sure if I should cover JWT first or middleware first." },
    { id: 'ts-11', start: 55.0, end: 68.0, text: "Let's go with middleware. Express middleware is just a function that gets request, response, and next. You can chain them, and they execute in order." },
    { id: 'ts-12', start: 68.0, end: 74.0, text: "So as I was saying about the project structure... actually I already covered that." },
    { id: 'ts-13', start: 74.0, end: 90.0, text: "For JWT authentication, we'll create a middleware that verifies the token on every request. Here's how you set that up with jsonwebtoken package." },
  ],
};

const MOCK_KNOWLEDGE = {
  nodes: [
    { id: 'rest-api', name: 'REST API', description: 'Architectural style for networked applications using HTTP methods to perform CRUD operations on resources.', type: 'concept', connections: 3 },
    { id: 'express', name: 'Express.js', description: 'Minimal Node.js web framework for routing, middleware, and HTTP utilities.', type: 'tool', connections: 2 },
    { id: 'jwt', name: 'JWT Authentication', description: 'JSON Web Tokens for stateless authentication in APIs.', type: 'concept', connections: 2 },
    { id: 'middleware', name: 'Middleware Pattern', description: 'Functions that execute during the request-response cycle, modifying req/res or calling next().', type: 'pattern', connections: 3 },
    { id: 'crud', name: 'CRUD Operations', description: 'Create, Read, Update, Delete — maps to HTTP POST, GET, PUT/PATCH, DELETE.', type: 'concept', connections: 2 },
    { id: 'error-handling', name: 'Error Handling', description: 'Try-catch, error middleware, and structured error responses for graceful failure.', type: 'pattern', connections: 1 },
  ],
  edges: [
    { source: 'rest-api', target: 'express' }, { source: 'rest-api', target: 'crud' },
    { source: 'rest-api', target: 'middleware' }, { source: 'express', target: 'middleware' },
    { source: 'jwt', target: 'middleware' }, { source: 'jwt', target: 'rest-api' },
    { source: 'crud', target: 'express' }, { source: 'error-handling', target: 'middleware' },
  ],
};

bus.on('shell:transitioned', ({ to }) => {
  if (to === 'REVIEWING' && segmentsSignal.value.length === 0) {
    console.log('[Preview] Seeding mock segments, transcript, knowledge');
    segmentsSignal.value = MOCK_SEGMENTS;
    const initial = {};
    for (const seg of MOCK_SEGMENTS) initial[seg.id] = 'pending';
    approvalsSignal.value = initial;
    transcriptSignal.value = MOCK_TRANSCRIPT_DATA;
    knowledgeSignal.value = MOCK_KNOWLEDGE;
  }
});

const eventLog = signal([]);
const originalEmit = bus.emit.bind(bus);

// Track last few events for the debug panel
const _origEmit = bus.emit;
bus.emit = function(event, data) {
  eventLog.value = [{ event, time: new Date().toLocaleTimeString(), data: JSON.stringify(data || {}).slice(0, 60) }, ...eventLog.value].slice(0, 20);
  return _origEmit.call(bus, event, data);
};

console.log('%c[EditorLens Preview]%c Running on :9999 with mock transport', 'color:#4dabf7;font-weight:700', 'color:#999');

// Panel configurations
const PANELS = [
  { id: 'main', label: 'Main', icon: 'M' },
  { id: 'stock', label: 'Stock', icon: 'S' },
  { id: 'transcript', label: 'Transcript', icon: 'T' },
  { id: 'all', label: 'All Panels', icon: '|||' },
];

function PanelChrome({ label, width, children }) {
  return (
    <div style={`width:${width};display:flex;flex-direction:column;height:100%;position:relative;min-width:280px`}>
      <div style="display:flex;align-items:center;gap:8px;padding:3px 10px;background:#161616;border-bottom:1px solid #2a2a2a;min-height:26px;flex-shrink:0">
        <span style="font-size:10px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.8px">{label}</span>
      </div>
      <div style="flex:1;overflow:auto;background:#1e1e1e">
        {children}
      </div>
    </div>
  );
}

function PanelDivider() {
  return <div style="width:2px;background:#0d0d0d;flex-shrink:0" />;
}

function DebugPanel() {
  const [open, setOpen] = useState(false);
  const events = eventLog.value;
  const state = shellState.value;

  if (!open) {
    return (
      <div
        onClick={() => setOpen(true)}
        style="position:fixed;bottom:12px;right:12px;background:#1a1a2e;border:1px solid #2a2a4a;border-radius:8px;padding:6px 12px;cursor:pointer;z-index:1000;display:flex;align-items:center;gap:8px;transition:all 0.2s ease"
      >
        <span style="width:6px;height:6px;border-radius:50%;background:#4dabf7;animation:pulse 2s infinite" />
        <span style="font-size:10px;color:#8888cc">Debug</span>
        <span style="font-size:10px;color:#4dabf7;font-weight:600">{state}</span>
      </div>
    );
  }

  return (
    <div style="position:fixed;bottom:12px;right:12px;width:360px;max-height:400px;background:#12121e;border:1px solid #2a2a4a;border-radius:10px;z-index:1000;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.5)">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#1a1a2e;border-bottom:1px solid #2a2a4a">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="width:6px;height:6px;border-radius:50%;background:#4dabf7;animation:pulse 2s infinite" />
          <span style="font-size:11px;font-weight:600;color:#8888cc">Event Bus</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:10px;padding:2px 8px;background:#2a2a4a;border-radius:3px;color:#4dabf7;font-weight:600">{state}</span>
          <span onClick={() => setOpen(false)} style="cursor:pointer;color:#666;font-size:14px;line-height:1">x</span>
        </div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:6px">
        {events.length === 0 && (
          <div style="padding:12px;color:#555;font-size:11px;text-align:center">No events yet</div>
        )}
        {events.map((e, i) => (
          <div key={i} style={`display:flex;gap:8px;padding:4px 6px;border-radius:3px;font-size:10px;${i === 0 ? 'background:rgba(77,171,247,0.08);' : ''}`}>
            <span style="color:#555;min-width:55px;font-family:monospace">{e.time}</span>
            <span style="color:#74c0fc;font-weight:500;min-width:120px">{e.event}</span>
            <span style="color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{e.data}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Preview() {
  const [activePanel, setActivePanel] = useState('main');

  return (
    <div style="display:flex;flex-direction:column;height:100vh;background:#0d0d0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif">
      {/* Top chrome bar — mimics Premiere workspace header */}
      <div style="display:flex;align-items:center;padding:0 16px;background:#141414;border-bottom:1px solid #2a2a2a;min-height:38px;flex-shrink:0;gap:0">
        {/* Logo */}
        <div style="display:flex;align-items:center;gap:10px;margin-right:24px">
          <div style="width:24px;height:24px;border-radius:5px;background:linear-gradient(135deg,#4dabf7,#228be6);display:flex;align-items:center;justify-content:center">
            <span style="color:#fff;font-size:11px;font-weight:800">EL</span>
          </div>
          <span style="font-size:13px;font-weight:600;color:#e0e0e0;letter-spacing:-0.2px">EditorLens</span>
          <span style="font-size:10px;color:#555;font-weight:500">v2.0</span>
        </div>

        {/* Separator */}
        <div style="width:1px;height:18px;background:#2a2a2a;margin-right:12px" />

        {/* Panel tabs */}
        <div style="display:flex;gap:0;height:100%">
          {PANELS.map(p => {
            const active = activePanel === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setActivePanel(p.id)}
                style={`display:flex;align-items:center;gap:6px;padding:0 16px;cursor:pointer;height:100%;
                  border-bottom:2px solid ${active ? '#4dabf7' : 'transparent'};
                  background:${active ? 'rgba(77,171,247,0.06)' : 'transparent'};
                  transition:all 0.15s ease`}
              >
                <span style={`font-size:11px;font-weight:${active ? '600' : '400'};color:${active ? '#e0e0e0' : '#666'};
                  transition:color 0.15s ease;letter-spacing:0.2px`}>
                  {p.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Right side */}
        <div style="flex:1" />
        <div style="display:flex;align-items:center;gap:12px">
          <span style="font-size:10px;color:#555">Mock Transport</span>
          <span style="width:6px;height:6px;border-radius:50%;background:#4caf50" />
        </div>
      </div>

      {/* Panel content area */}
      <div style="flex:1;display:flex;overflow:hidden">
        {activePanel === 'main' && (
          <PanelChrome label="editorlens.main" width="100%">
            <Shell bus={bus} transport={transport} />
          </PanelChrome>
        )}

        {activePanel === 'stock' && (
          <PanelChrome label="editorlens.stock" width="100%">
            <div style="background:#1e1e1e;min-height:100%;color:#e0e0e0;font-size:13px;font-family:inherit">
              <StockBrowser bus={bus} />
            </div>
          </PanelChrome>
        )}

        {activePanel === 'transcript' && (
          <PanelChrome label="editorlens.transcript" width="100%">
            <div style="background:#1e1e1e;min-height:100%;color:#e0e0e0;font-size:13px;font-family:inherit">
              <TranscriptView bus={bus} projectId={shellContext.value?.projectId || 'mock-1'} />
            </div>
          </PanelChrome>
        )}

        {activePanel === 'all' && (
          <>
            <PanelChrome label="editorlens.main" width="50%">
              <Shell bus={bus} transport={transport} />
            </PanelChrome>
            <PanelDivider />
            <PanelChrome label="editorlens.stock" width="25%">
              <div style="background:#1e1e1e;min-height:100%;color:#e0e0e0;font-size:13px;font-family:inherit">
                <StockBrowser bus={bus} />
              </div>
            </PanelChrome>
            <PanelDivider />
            <PanelChrome label="editorlens.transcript" width="25%">
              <div style="background:#1e1e1e;min-height:100%;color:#e0e0e0;font-size:13px;font-family:inherit">
                <TranscriptView bus={bus} projectId={shellContext.value?.projectId || 'mock-1'} />
              </div>
            </PanelChrome>
          </>
        )}
      </div>

      {/* Debug overlay */}
      <DebugPanel />
    </div>
  );
}

render(<Preview />, document.getElementById('root'));
