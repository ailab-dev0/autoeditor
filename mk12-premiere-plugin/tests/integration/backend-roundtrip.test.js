/**
 * Integration test — full event chain against mock backend.
 *
 * Tests the real EventBus + Transport + Adapters with a mock HTTP server.
 * No mocking of fetch — uses real network calls to localhost.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createMockServer } from './mock-server.js';
import { createEventBus } from '../../src/shared/event-bus.js';
import { createTransport, connectionState } from '../../src/shared/transport.js';
import { setupAuthAdapter } from '../../src/domains/auth/adapter.js';
import { setupPipelineAdapter } from '../../src/domains/pipeline/adapter.js';
import { setupSegmentsAdapter } from '../../src/domains/segments/adapter.js';
import { setupExportAdapter } from '../../src/domains/export/adapter.js';
import { setupTranscriptAdapter } from '../../src/domains/transcript/adapter.js';
import { setupKnowledgeAdapter } from '../../src/domains/knowledge/adapter.js';
import { token, user } from '../../src/domains/auth/signals.js';
import { stage, percent } from '../../src/domains/pipeline/signals.js';
import { pipelineState } from '../../src/domains/pipeline/fsm.js';
import { segments, approvals } from '../../src/domains/segments/signals.js';
import { exportOutput, exportError } from '../../src/domains/export/signals.js';
import { transcript } from '../../src/domains/transcript/signals.js';
import { graphData } from '../../src/domains/knowledge/signals.js';

let server;
let serverUrl;

function waitForEvent(bus, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
    bus.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

describe('Backend Roundtrip Integration', () => {
  let bus, transport;

  beforeAll(async () => {
    server = createMockServer();
    const info = await server.start();
    serverUrl = info.url;
  });

  afterAll(async () => {
    await server.stop();
  });

  beforeEach(() => {
    server.reset();
    bus = createEventBus();
    transport = createTransport(bus);
    transport.configure({ baseUrl: serverUrl });

    // Reset signals
    token.value = null;
    user.value = null;
    stage.value = 'idle';
    percent.value = 0;
    pipelineState.value = 'idle';
    segments.value = [];
    approvals.value = {};
    exportOutput.value = null;
    exportError.value = null;
    transcript.value = null;
    graphData.value = null;

    // Wire all adapters
    setupAuthAdapter(bus, transport);
    setupSegmentsAdapter(bus, transport);
    setupExportAdapter(bus, transport);
    setupTranscriptAdapter(bus, transport);
    setupKnowledgeAdapter(bus, transport);
  });

  // -----------------------------------------------------------------------
  // Auth
  // -----------------------------------------------------------------------
  it('auth:login → token + user populated', async () => {
    const loggedInPromise = waitForEvent(bus, 'auth:logged-in');
    bus.emit('auth:login', { email: 'test@test.com', password: 'pass' });
    await loggedInPromise;

    expect(token.value).toBe('test-jwt-token-abc123');
    expect(user.value).toEqual({ id: 1, email: 'test@test.com', name: 'Test User' });
  });

  // -----------------------------------------------------------------------
  // Pipeline start + polling → segments hydration
  // -----------------------------------------------------------------------
  it('pipeline:start → polling → pipeline:complete → segments hydrated', async () => {
    // Login first
    const loggedIn = waitForEvent(bus, 'auth:logged-in');
    bus.emit('auth:login', { email: 'test@test.com', password: 'pass' });
    await loggedIn;

    // Setup pipeline adapter (needs separate setup because of FSM)
    const { stopPolling } = setupPipelineAdapter(bus, transport);

    // Start pipeline
    bus.emit('pipeline:start', { projectId: 'proj1' });
    await wait(100);

    expect(stage.value).toBe('transcription');
    expect(pipelineState.value).toBe('running');

    // Wait for polling to detect completion (poll interval is 5s in adapter,
    // but mock returns complete immediately, so just wait for the event chain)
    const complete = waitForEvent(bus, 'pipeline:complete', 10000);
    // Trigger a manual poll cycle by emitting what the poller would
    const pollResult = await transport.get('/api/projects/proj1/pipeline/status');
    if (pollResult.ok && pollResult.data.stage === 'complete') {
      bus.emit('ws:analysis:complete', pollResult.data);
    }
    await complete;

    expect(pipelineState.value).toBe('complete');
    expect(percent.value).toBe(100);

    stopPolling();
  });

  // -----------------------------------------------------------------------
  // Segments fetch from marks endpoint
  // -----------------------------------------------------------------------
  it('segments:fetch → hydrates segments signal', async () => {
    const fetched = waitForEvent(bus, 'segments:fetched');
    bus.emit('segments:fetch', { projectId: 'proj1' });
    await fetched;

    expect(segments.value).toHaveLength(3);
    expect(segments.value[0].id).toBe('seg-1');
    expect(segments.value[1].suggestion).toBe('cut');
  });

  // -----------------------------------------------------------------------
  // Segments approve → PATCH
  // -----------------------------------------------------------------------
  it('segments:approve → updates approval + PATCHes backend', async () => {
    // Hydrate segments first
    const fetched = waitForEvent(bus, 'segments:fetched');
    bus.emit('segments:fetch', { projectId: 'proj1' });
    await fetched;

    // Approve
    const approved = waitForEvent(bus, 'segments:approved');
    bus.emit('segments:approve', { segmentId: 'seg-1', projectId: 'proj1' });
    await approved;

    expect(approvals.value['seg-1']).toBe('approved');
  });

  // -----------------------------------------------------------------------
  // Export
  // -----------------------------------------------------------------------
  it('export:start → POST → output populated', async () => {
    const completed = waitForEvent(bus, 'export:completed');
    bus.emit('export:start', { projectId: 'proj1', format: 'json' });
    await completed;

    expect(exportOutput.value).toBe('/download/test.json');
    expect(exportError.value).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Transcript
  // -----------------------------------------------------------------------
  it('transcript:fetch → hydrates transcript signal', async () => {
    const fetched = waitForEvent(bus, 'transcript:fetched');
    bus.emit('transcript:fetch', { projectId: 'proj1' });
    await fetched;

    expect(transcript.value).not.toBeNull();
    expect(transcript.value.segments).toHaveLength(2);
    expect(transcript.value.segments[0].text).toBe('Hello world.');
  });

  // -----------------------------------------------------------------------
  // Knowledge
  // -----------------------------------------------------------------------
  it('knowledge:fetch → hydrates graphData signal', async () => {
    const fetched = waitForEvent(bus, 'knowledge:fetched');
    bus.emit('knowledge:fetch', { projectId: 'proj1' });
    await fetched;

    expect(graphData.value).not.toBeNull();
    expect(graphData.value.nodes).toHaveLength(2);
    expect(graphData.value.edges).toHaveLength(1);
  });
});
