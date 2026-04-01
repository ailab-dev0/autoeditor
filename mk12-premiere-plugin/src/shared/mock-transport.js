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
  text: '',
  segments: [
    { id: 'ts-1', start: 0, end: 4.2, text: 'Hey everyone, welcome back to the channel.' },
    { id: 'ts-2', start: 4.2, end: 8.5, text: 'Today we\'re going to build a REST API from scratch using Node.js and Express.' },
    { id: 'ts-3', start: 8.5, end: 15.0, text: 'By the end of this video, you\'ll have a fully working API with authentication, CRUD operations, and error handling.' },
    { id: 'ts-4', start: 15.0, end: 18.3, text: 'Um... let me just pull up my editor here.' },
    { id: 'ts-5', start: 18.3, end: 22.0, text: 'OK so... yeah, let\'s just skip that part actually.' },
    { id: 'ts-6', start: 22.0, end: 28.7, text: 'Alright, so the first thing we need to do is set up our project structure.' },
    { id: 'ts-7', start: 28.7, end: 35.2, text: 'I\'m going to create a new directory, run npm init, and install Express and a few other dependencies.' },
    { id: 'ts-8', start: 35.2, end: 40.0, text: 'Let me walk you through the folder layout — we\'ll have routes, controllers, middleware, and models.' },
    { id: 'ts-9', start: 40.0, end: 46.5, text: 'Now this next section is a bit tricky, and honestly I\'m not sure if I should cover it now or later.' },
    { id: 'ts-10', start: 46.5, end: 52.0, text: 'Let\'s go with the authentication middleware first since everything depends on it.' },
    { id: 'ts-11', start: 52.0, end: 55.0, text: 'We\'ll use JWT tokens for auth — I\'ll show you exactly how to set that up.' },
  ],
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
function matchRoute(method, path, body) {
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
      { id: 'mock-1', name: 'How to Build a REST API', status: 'ready', created_at: '2026-03-28T14:22:00Z' },
      { id: 'mock-2', name: 'React Hooks Deep Dive', status: 'ready', created_at: '2026-03-27T09:15:00Z' },
      { id: 'mock-3', name: 'System Design Interview Prep', status: 'processing', created_at: '2026-03-30T08:00:00Z' },
      { id: 'mock-4', name: 'Docker for Beginners', status: 'error', created_at: '2026-03-25T11:30:00Z' },
    ];
  }
  if (method === 'POST' && path === '/api/projects') {
    const id = 'mock-' + Date.now();
    return { project: { id, name: body?.name || 'Untitled', status: 'ready', created_at: new Date().toISOString() } };
  }
  if (method === 'GET' && path.startsWith('/api/projects/mock-')) {
    const id = path.split('/')[3];
    return { id, name: 'Mock Project', status: 'ready', created_at: '2026-03-28T14:22:00Z' };
  }
  if (method === 'PUT' && path.includes('/api/projects/')) {
    return { ok: true };
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
    // Return in-progress so polling doesn't pre-empt the simulated WS completion
    return { stage: 'analysis', percent: 45, status: 'running' };
  }
  if (method === 'POST' && path.includes('/generate-script')) {
    return { operations: [] };
  }
  if (method === 'GET' && path.includes('/knowledge')) {
    return {
      nodes: [
        { id: 'rest-api', name: 'REST API', description: 'Representational State Transfer — architectural style for networked applications using HTTP methods (GET, POST, PUT, DELETE) to perform CRUD operations on resources.', type: 'concept', connections: 3 },
        { id: 'express', name: 'Express.js', description: 'Minimal and flexible Node.js web framework providing robust features for building web and mobile applications. Handles routing, middleware, and HTTP utilities.', type: 'tool', connections: 2 },
        { id: 'jwt', name: 'JWT Authentication', description: 'JSON Web Tokens — compact, URL-safe tokens for securely transmitting claims between parties. Used for stateless authentication in APIs.', type: 'concept', connections: 2 },
        { id: 'middleware', name: 'Middleware Pattern', description: 'Functions that execute during the request-response cycle. Can modify request/response objects, end the cycle, or call the next middleware.', type: 'pattern', connections: 3 },
        { id: 'crud', name: 'CRUD Operations', description: 'Create, Read, Update, Delete — the four basic operations for persistent storage. Maps to HTTP POST, GET, PUT/PATCH, DELETE.', type: 'concept', connections: 2 },
        { id: 'error-handling', name: 'Error Handling', description: 'Strategies for catching, logging, and responding to errors gracefully. Includes try-catch, error middleware, and structured error responses.', type: 'pattern', connections: 1 },
      ],
      edges: [
        { source: 'rest-api', target: 'express' },
        { source: 'rest-api', target: 'crud' },
        { source: 'rest-api', target: 'middleware' },
        { source: 'express', target: 'middleware' },
        { source: 'jwt', target: 'middleware' },
        { source: 'jwt', target: 'rest-api' },
        { source: 'crud', target: 'express' },
        { source: 'error-handling', target: 'middleware' },
      ],
    };
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

  async function mockRequest(method, path, body) {
    await delay(150 + Math.random() * 100);
    const data = matchRoute(method, path, body);
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
      const result = await mockRequest('POST', path, body);
      if (path.endsWith('/pipeline/start')) {
        simulatePipeline(bus);
      }
      return result;
    },

    put: (path, body) => mockRequest('PUT', path, body),

    patch: (path, body) => mockRequest('PATCH', path, body),

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
