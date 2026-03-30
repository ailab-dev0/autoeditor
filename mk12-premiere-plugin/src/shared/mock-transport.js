/**
 * Mock transport — canned responses for Premiere manual testing without a backend.
 *
 * Enable with: localStorage.setItem('editorlens-dev', 'true')
 * Same interface as createTransport(bus).
 */
import { signal } from '@preact/signals';
import { connectionState, reconnectAttempt, setTokenSignal } from './transport.js';

// ---------------------------------------------------------------------------
// Mock edit package — 4 segments, realistic v3 format
// ---------------------------------------------------------------------------
const MOCK_EDIT_PACKAGE = {
  version: 'v3',
  project_name: 'Mock Project',
  pipeline_session_id: 'mock-session-001',
  pedagogy_score: 0.82,
  chapters: [
    { name: 'Introduction', order: 0, target_duration: 55 },
  ],
  videos: [{
    video_path: '/mock/video.mp4',
    segments: [
      {
        id: 'seg-1', start: 0, end: 15, suggestion: 'keep',
        confidence: 0.95, explanation: 'Strong intro with clear hook',
        content_mark: null, transition_after: null,
      },
      {
        id: 'seg-2', start: 15, end: 22, suggestion: 'cut',
        confidence: 0.88, explanation: 'Dead air / filler content',
        content_mark: null, transition_after: 'cross_dissolve',
      },
      {
        id: 'seg-3', start: 22, end: 40, suggestion: 'trim_start',
        confidence: 0.72, explanation: 'Slow ramp-up, trim first 3 seconds',
        content_mark: null, transition_after: null,
      },
      {
        id: 'seg-4', start: 40, end: 55, suggestion: 'review',
        confidence: 0.60, explanation: 'Uncertain — may contain key concept, needs human review',
        content_mark: null, transition_after: null,
      },
    ],
  }],
};

const MOCK_TRANSCRIPT = {
  text: 'Welcome to this tutorial. Today we\'ll cover the fundamentals of video editing with EditorLens. '
    + 'First, let\'s look at... um... the timeline. The timeline is where all your clips live. '
    + 'You can drag clips around, trim them, and add transitions between them. '
    + 'Now, this next part is important — or maybe not, I\'m not sure. Let me think about it.',
  segments: MOCK_EDIT_PACKAGE.videos[0].segments.map(s => ({
    id: s.id, start: s.start, end: s.end, text: `[Segment ${s.id}] speaking...`,
  })),
};

const MOCK_STOCK_RESULTS = [
  { id: 'stock-1', title: 'Abstract code background', provider: 'pexels', thumbnail: 'https://via.placeholder.com/320x180/1a1a2e/e0e0e0?text=Code+BG', duration: 12 },
  { id: 'stock-2', title: 'Person typing on laptop', provider: 'pexels', thumbnail: 'https://via.placeholder.com/320x180/16213e/e0e0e0?text=Typing', duration: 8 },
  { id: 'stock-3', title: 'Data visualization dashboard', provider: 'pixabay', thumbnail: 'https://via.placeholder.com/320x180/0f3460/e0e0e0?text=Dashboard', duration: 15 },
  { id: 'stock-4', title: 'Whiteboard brainstorming', provider: 'pixabay', thumbnail: 'https://via.placeholder.com/320x180/533483/e0e0e0?text=Whiteboard', duration: 10 },
];

// ---------------------------------------------------------------------------
// Route matcher
// ---------------------------------------------------------------------------
function matchRoute(method, path) {
  if (method === 'GET' && path === '/api/health') {
    return { status: 'ok', version: '2.0.0-mock' };
  }
  if (method === 'POST' && path === '/api/auth/login') {
    return { token: 'mock-jwt-token-dev', user: { id: 'dev-1', email: 'dev@local', name: 'Dev User' } };
  }
  if (method === 'POST' && path === '/api/auth/refresh') {
    return { token: 'mock-jwt-token-refreshed' };
  }
  if (method === 'GET' && path === '/api/projects') {
    return [
      { id: 'mock-1', name: 'Mock Project', description: 'A mock project for testing', created: '2026-03-30T00:00:00Z' },
    ];
  }
  if (method === 'GET' && path === '/api/projects/mock-1') {
    return { id: 'mock-1', name: 'Mock Project', description: 'A mock project for testing', created: '2026-03-30T00:00:00Z' };
  }
  if (method === 'POST' && path.endsWith('/pipeline/start')) {
    return { started: true, sessionId: 'mock-session-001' };
  }
  if (method === 'PATCH' && path.includes('/segments/bulk')) {
    return { updated: 1 };
  }
  if (method === 'GET' && path.includes('/transcript')) {
    return MOCK_TRANSCRIPT;
  }
  if (method === 'GET' && path === '/api/stock/search') {
    return MOCK_STOCK_RESULTS;
  }
  if (method === 'GET' && path.includes('/pipeline/status')) {
    return { stage: 'complete', percent: 100 };
  }
  if (method === 'POST' && path.includes('/generate-script')) {
    return { operations: [] };
  }
  if (method === 'GET' && path.includes('/knowledge')) {
    return { concepts: [], relationships: [] };
  }
  if (method === 'POST' && path.includes('/export')) {
    return { exportId: 'mock-export-1', status: 'completed', output: 'mock-export-output.json' };
  }
  if (method === 'GET' && path.includes('/export')) {
    return { status: 'completed', output: 'mock-export-output.json' };
  }
  // Fallback
  return {};
}

// ---------------------------------------------------------------------------
// Pipeline simulation
// ---------------------------------------------------------------------------
function simulatePipeline(bus) {
  const stages = [
    { stage: 'transcription', percent: 10, eta: 2500, cost: 5, delay: 0 },
    { stage: 'transcription', percent: 20, eta: 2000, cost: 10, delay: 600 },
    { stage: 'analysis', percent: 35, eta: 1500, cost: 25, delay: 1200 },
    { stage: 'analysis', percent: 50, eta: 1200, cost: 40, delay: 1600 },
    { stage: 'scoring', percent: 65, eta: 800, cost: 55, delay: 2000 },
    { stage: 'scoring', percent: 70, eta: 600, cost: 60, delay: 2200 },
    { stage: 'packaging', percent: 85, eta: 300, cost: 70, delay: 2600 },
    { stage: 'packaging', percent: 90, eta: 150, cost: 75, delay: 2800 },
  ];

  for (const s of stages) {
    setTimeout(() => {
      bus.emit('ws:analysis:progress', s);
    }, s.delay);
  }

  // Complete after 3s
  setTimeout(() => {
    bus.emit('ws:analysis:complete', { editPackage: MOCK_EDIT_PACKAGE });
  }, 3000);
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createMockTransport(bus) {
  async function delay(ms = 200) {
    return new Promise(r => setTimeout(r, ms));
  }

  async function mockRequest(method, path) {
    await delay(150 + Math.random() * 100);
    const data = matchRoute(method, path);
    return { ok: true, data, error: null };
  }

  // Simulate connection on init
  setTimeout(() => {
    connectionState.value = 'connecting';
    setTimeout(() => {
      connectionState.value = 'connected';
      reconnectAttempt.value = 0;
    }, 500);
  }, 100);

  return {
    configure() {},
    getBaseUrl() { return 'http://mock:8000'; },

    get: (path) => mockRequest('GET', path),

    post: async (path, body) => {
      const result = await mockRequest('POST', path);
      // Trigger pipeline simulation when starting
      if (path.endsWith('/pipeline/start')) {
        simulatePipeline(bus);
      }
      return result;
    },

    patch: (path, body) => mockRequest('PATCH', path),

    connectWs() {
      // Mock WS is handled by simulatePipeline via bus events
    },

    onPoll() {},

    broadcastSync() {},

    disconnect() {
      connectionState.value = 'disconnected';
      reconnectAttempt.value = 0;
    },
  };
}
