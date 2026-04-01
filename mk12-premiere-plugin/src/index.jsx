/**
 * EditorLens v2 — Plugin entry point.
 * Single script that registers all panels with UXP via entrypoints.setup().
 */
import { h, render } from 'preact';
import './shared/styles/utilities.css';
import { entrypoints } from 'uxp';
import { createEventBus } from './shared/event-bus';
import { createTransport } from './shared/transport';
import { createMockTransport } from './shared/mock-transport';
import { createShellFsm, shellState } from './shell/fsm';
import { setupAuthAdapter } from './domains/auth/adapter';
import { setupPipelineAdapter } from './domains/pipeline/adapter';
import { setupSegmentsAdapter } from './domains/segments/adapter';
import { setupTimelineAdapter } from './domains/timeline/adapter';
import { setupStockAdapter } from './domains/stock/adapter';
import { setupTranscriptAdapter } from './domains/transcript/adapter';
import { setupExportAdapter } from './domains/export/adapter';
import { setupKnowledgeAdapter } from './domains/knowledge/adapter';
import { setupProjectLoader } from './domains/pipeline/project-loader';
import { segments as segmentsSignal, approvals as approvalsSignal } from './domains/segments/signals';
import { transcript as transcriptSignal } from './domains/transcript/signals';
import { graphData as knowledgeSignal } from './domains/knowledge/signals';
import { Shell } from './shell/Shell';
import { StockBrowser } from './domains/stock/components/StockBrowser';
import { TranscriptView } from './domains/transcript/components/TranscriptView';

function isDevMode() {
  try { return localStorage.getItem('editorlens-dev') === 'true'; } catch { return false; }
}

// Shared app state — initialized once, shared across panels
let bus = null;
let transport = null;
let fsm = null;

// -----------------------------------------------------------------------
// Mock data for dev mode
// -----------------------------------------------------------------------
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
    { id: 'ts-2', start: 4.2, end: 8.5, text: "Today we're going to build a REST API from scratch." },
    { id: 'ts-3', start: 8.5, end: 15.0, text: "By the end, you'll have a fully working API with auth and CRUD." },
    { id: 'ts-4', start: 15.0, end: 18.3, text: 'Um... let me just pull up my editor here.' },
    { id: 'ts-5', start: 18.3, end: 22.0, text: "OK so... yeah, let's just skip that part." },
    { id: 'ts-6', start: 22.0, end: 28.7, text: 'First thing — set up the project structure.' },
    { id: 'ts-7', start: 28.7, end: 35.2, text: "npm init, install Express, set up routes and controllers." },
    { id: 'ts-8', start: 35.2, end: 40.0, text: "Folder layout: routes, controllers, middleware, models." },
    { id: 'ts-9', start: 40.0, end: 48.0, text: "Routes handle URL mapping, controllers have business logic, middleware handles auth." },
    { id: 'ts-10', start: 48.0, end: 55.0, text: "Should I cover JWT or middleware first? Let's go with middleware." },
    { id: 'ts-11', start: 55.0, end: 68.0, text: "Express middleware is a function with req, res, next. Chain them, they execute in order." },
    { id: 'ts-12', start: 68.0, end: 74.0, text: "As I was saying about project structure... actually already covered that." },
    { id: 'ts-13', start: 74.0, end: 90.0, text: "For JWT auth, create middleware that verifies the token on every request." },
  ],
};

const MOCK_KNOWLEDGE = {
  nodes: [
    { id: 'rest-api', name: 'REST API', description: 'Architectural style using HTTP methods for CRUD on resources.', type: 'concept', connections: 3 },
    { id: 'express', name: 'Express.js', description: 'Minimal Node.js web framework for routing and middleware.', type: 'tool', connections: 2 },
    { id: 'jwt', name: 'JWT Authentication', description: 'JSON Web Tokens for stateless API authentication.', type: 'concept', connections: 2 },
    { id: 'middleware', name: 'Middleware Pattern', description: 'Functions in the request-response cycle: modify req/res or call next().', type: 'pattern', connections: 3 },
    { id: 'crud', name: 'CRUD Operations', description: 'Create, Read, Update, Delete — maps to POST, GET, PUT, DELETE.', type: 'concept', connections: 2 },
    { id: 'error-handling', name: 'Error Handling', description: 'Try-catch, error middleware, structured error responses.', type: 'pattern', connections: 1 },
  ],
  edges: [
    { source: 'rest-api', target: 'express' }, { source: 'rest-api', target: 'crud' },
    { source: 'rest-api', target: 'middleware' }, { source: 'express', target: 'middleware' },
    { source: 'jwt', target: 'middleware' }, { source: 'jwt', target: 'rest-api' },
    { source: 'crud', target: 'express' }, { source: 'error-handling', target: 'middleware' },
  ],
};

// -----------------------------------------------------------------------
// App initialization
// -----------------------------------------------------------------------
function ensureApp() {
  if (bus) return;
  bus = createEventBus();
  transport = isDevMode() ? createMockTransport(bus) : createTransport(bus);
  fsm = createShellFsm(bus);

  setupAuthAdapter(bus, transport);
  setupPipelineAdapter(bus, transport);
  setupSegmentsAdapter(bus, transport);
  setupTimelineAdapter(bus, transport);
  setupStockAdapter(bus, transport);
  setupTranscriptAdapter(bus, transport);
  setupExportAdapter(bus, transport);
  setupKnowledgeAdapter(bus, transport);
  setupProjectLoader(bus, transport);

  if (isDevMode()) {
    console.log('[EditorLens v2] Dev mode — using mock transport');

    // Dev mode: auto-start pipeline when project selected
    bus.on('project:selected', ({ projectId }) => {
      setTimeout(() => bus.emit('pipeline:start', { projectId }), 300);
    });

    // Dev mode: seed mock data when entering REVIEWING
    // This ensures segments always show even if pipeline event chain is incomplete
    bus.on('shell:transitioned', ({ to }) => {
      if (to === 'REVIEWING' && segmentsSignal.value.length === 0) {
        console.log('[EditorLens v2] Seeding mock segments + transcript + knowledge');
        segmentsSignal.value = MOCK_SEGMENTS;
        const initial = {};
        for (const seg of MOCK_SEGMENTS) initial[seg.id] = 'pending';
        approvalsSignal.value = initial;
        transcriptSignal.value = MOCK_TRANSCRIPT_DATA;
        knowledgeSignal.value = MOCK_KNOWLEDGE;
      }
    });
  }
}

function createPanelController(ComponentFn) {
  let root = null;
  let attachment = null;

  return {
    create() {
      root = document.createElement('div');
      root.style.height = '100%';
      root.style.overflow = 'auto';
      ensureApp();
      render(ComponentFn(), root);
      return root;
    },

    show(event) {
      if (!root) this.create();
      attachment = event;
      attachment.appendChild(root);
    },

    hide() {
      if (attachment && root) {
        attachment.removeChild(root);
        attachment = null;
      }
    },

    destroy() {
      if (root) render(null, root);
      root = null;
      attachment = null;
    }
  };
}

const mainController = createPanelController(() => <Shell bus={bus} transport={transport} />);
const stockController = createPanelController(() => <StockBrowser bus={bus} />);
const transcriptController = createPanelController(() => <TranscriptView bus={bus} />);

entrypoints.setup({
  plugin: {
    create() { console.log('[EditorLens v2] Plugin created'); },
    destroy() {
      transport?.disconnect?.();
      bus?.destroy?.();
      bus = null;
      transport = null;
      fsm = null;
      console.log('[EditorLens v2] Plugin destroyed');
    }
  },
  panels: {
    'editorlens.main': mainController,
    'editorlens.stock': stockController,
    'editorlens.transcript': transcriptController
  }
});
