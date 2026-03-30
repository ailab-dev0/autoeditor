/**
 * Lightweight mock backend using Node http module.
 * Implements the endpoints the v2 plugin talks to.
 */
import { createServer } from 'http';

const TEST_USER = { id: 1, email: 'test@test.com', name: 'Test User' };
const TEST_TOKEN = 'test-jwt-token-abc123';
const TEST_PROJECT = { id: 'proj1', name: 'Test Project', status: 'ready' };

const TEST_EDIT_PACKAGE = {
  version: 'v3',
  project_name: 'Test Project',
  pipeline_session_id: 'sess-integration-1',
  pedagogy_score: 0.88,
  chapters: [{ name: 'Intro', order: 0, target_duration: 60 }],
  videos: [{
    video_path: '/test/video.mp4',
    segments: [
      { id: 'seg-1', start: 0, end: 10, suggestion: 'keep', confidence: 0.95, explanation: 'Good content' },
      { id: 'seg-2', start: 10, end: 18, suggestion: 'cut', confidence: 0.92, explanation: 'Dead air' },
      { id: 'seg-3', start: 18, end: 30, suggestion: 'trim_start', confidence: 0.78, explanation: 'Slow intro' },
    ],
  }],
};

let pipelineStarted = false;

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const routes = {
  'POST /api/auth/login': async (req, res) => {
    const body = await parseBody(req);
    if (body.email && body.password) {
      json(res, 200, { token: TEST_TOKEN, user: TEST_USER });
    } else {
      json(res, 401, { error: 'Invalid credentials' });
    }
  },

  'POST /api/auth/refresh': async (req, res) => {
    json(res, 200, { token: TEST_TOKEN + '-refreshed' });
  },

  'GET /api/projects': (req, res) => {
    json(res, 200, [TEST_PROJECT]);
  },

  'GET /api/projects/proj1': (req, res) => {
    json(res, 200, TEST_PROJECT);
  },

  'POST /api/projects/proj1/pipeline/start': async (req, res) => {
    pipelineStarted = true;
    json(res, 200, { status: 'started', sessionId: 'sess-integration-1' });
  },

  'GET /api/projects/proj1/pipeline/status': (req, res) => {
    if (pipelineStarted) {
      json(res, 200, {
        stage: 'complete',
        percent: 100,
        editPackage: TEST_EDIT_PACKAGE,
      });
    } else {
      json(res, 200, { stage: 'idle', percent: 0 });
    }
  },

  'GET /api/projects/proj1/marks': (req, res) => {
    json(res, 200, TEST_EDIT_PACKAGE.videos[0].segments);
  },

  'PATCH /api/projects/proj1/segments/bulk': async (req, res) => {
    const body = await parseBody(req);
    json(res, 200, { updated: body.segments?.length || 0 });
  },

  'POST /api/projects/proj1/export': async (req, res) => {
    const body = await parseBody(req);
    json(res, 200, { url: '/download/test.json', format: body.format });
  },

  'GET /api/projects/proj1/transcript': (req, res) => {
    json(res, 200, {
      text: 'Hello world. This is a test.',
      segments: [
        { start: 0, end: 5, text: 'Hello world.' },
        { start: 5, end: 10, text: 'This is a test.' },
      ],
    });
  },

  'GET /api/projects/proj1/knowledge': (req, res) => {
    json(res, 200, {
      nodes: [
        { id: 'n1', label: 'React', type: 'technology' },
        { id: 'n2', label: 'Preact', type: 'technology' },
      ],
      edges: [{ source: 'n1', target: 'n2', label: 'alternative' }],
    });
  },
};

export function createMockServer() {
  const server = createServer((req, res) => {
    // Strip query params for route matching
    const urlPath = req.url.split('?')[0];
    const key = `${req.method} ${urlPath}`;
    const handler = routes[key];

    if (handler) {
      handler(req, res);
    } else {
      json(res, 404, { error: `No mock for ${key}` });
    }
  });

  return {
    start(port = 0) {
      return new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => {
          const addr = server.address();
          resolve({ port: addr.port, url: `http://127.0.0.1:${addr.port}` });
        });
      });
    },
    stop() {
      pipelineStarted = false;
      return new Promise((resolve) => server.close(resolve));
    },
    reset() {
      pipelineStarted = false;
    },
  };
}
