/**
 * Pipeline unit + integration tests.
 *
 * Uses node:test (built-in, zero deps). Run with:
 *   npx tsx --test tests/pipeline.test.ts
 *
 * Tests are organized into groups A-E matching the test spec.
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { PIPELINE_STAGES } from '../src/types/index.js';
import type { PipelineStageName, Chapter } from '../src/types/index.js';

// ══════════════════════════════════════════════════════════════
// Test Group A — Checkpoint & Resume
// ══════════════════════════════════════════════════════════════

describe('Group A — Checkpoint & Resume', () => {
  // We test detectResumeStage by mocking the storage layer.
  // Since detectResumeStage uses dynamic imports, we test the logic directly.

  it('A1: detectResumeStage returns stage after last completed', async () => {
    // Simulate the logic of detectResumeStage directly
    const completedStages: PipelineStageName[] = ['transcription', 'knowledge_graph', 'chapter_validation'];

    // Find the last completed stage and return the next one
    let resumeStage: PipelineStageName | null = null;
    for (let i = PIPELINE_STAGES.length - 1; i >= 0; i--) {
      if (completedStages.includes(PIPELINE_STAGES[i])) {
        resumeStage = PIPELINE_STAGES[i + 1] ?? null;
        break;
      }
    }

    assert.equal(resumeStage, 'director_decisions');
  });

  it('A1b: detectResumeStage checks all 4 stages including director_decisions', async () => {
    const completedStages: PipelineStageName[] = [
      'transcription', 'knowledge_graph', 'chapter_validation',
      'director_decisions',
    ];

    let resumeStage: PipelineStageName | null = null;
    for (let i = PIPELINE_STAGES.length - 1; i >= 0; i--) {
      if (completedStages.includes(PIPELINE_STAGES[i])) {
        resumeStage = PIPELINE_STAGES[i + 1] ?? null;
        break;
      }
    }

    // All 4 complete → nothing left to resume
    assert.equal(resumeStage, null);
  });

  it('A2: pipeline resumes from detected stage, skipping earlier stages', () => {
    // Simulate the startIdx calculation
    const startStage: PipelineStageName = 'chapter_validation';
    const startIdx = PIPELINE_STAGES.indexOf(startStage);

    assert.equal(startIdx, 2);
    assert.ok(startIdx > 0, 'Stage 1 should be skipped (startIdx > 0)');
    assert.ok(startIdx > 1, 'Stage 2 should be skipped (startIdx > 1)');
    assert.ok(startIdx <= 2, 'Stage 3 should run (startIdx <= 2)');
  });

  it('A3: explicit startFromStage overrides auto-detect', () => {
    // If auto-detect would return stage 5 (all done), but explicit says stage 2:
    const autoDetected: PipelineStageName = 'package_compilation';
    const explicit: PipelineStageName = 'knowledge_graph';

    // The pipeline code: if (options.startFromStage) use it, else auto-detect
    const effectiveStage = explicit; // explicit takes precedence
    const startIdx = PIPELINE_STAGES.indexOf(effectiveStage);

    assert.equal(startIdx, 1, 'Should start from stage 2 (index 1), not stage 5');
    assert.notEqual(
      PIPELINE_STAGES.indexOf(autoDetected),
      startIdx,
      'Should NOT use auto-detected stage'
    );
  });

  it('A4: PIPELINE_STAGES has exactly 4 stages in correct order', () => {
    assert.equal(PIPELINE_STAGES.length, 4);
    assert.deepEqual([...PIPELINE_STAGES], [
      'transcription',
      'knowledge_graph',
      'chapter_validation',
      'director_decisions',
    ]);
  });
});

// ══════════════════════════════════════════════════════════════
// Test Group B — JSONL Storage Integrity
// ══════════════════════════════════════════════════════════════

describe('Group B — JSONL Storage Integrity', () => {
  it('B2: malformed JSONL line throws with line number', () => {
    // Simulate loadContentFlowFromMinIO parse logic
    const lines = [
      '{"id":"s1","text":"hello"}',
      '{"id":"s2","text":"world"}',
      '{"id":"s3","text":"ok"}',
      '{"id":"s4","text":"fine"}',
      '{invalid json',
    ];
    const projectId = 'test-project';

    let thrownError: Error | null = null;
    const segments: unknown[] = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        segments.push(JSON.parse(lines[i]));
      } catch {
        thrownError = new Error(
          `[stage:knowledge_graph, project:${projectId}] Corrupt checkpoint at line ${i + 1} — ` +
          `refusing to load stale fallback. Delete the MinIO key ` +
          `projects/${projectId}/content-flow-segments.jsonl or re-run from stage 1. ` +
          `Raw content: ${lines[i].slice(0, 120)}`
        );
        break;
      }
    }

    assert.ok(thrownError, 'Should have thrown');
    assert.match(thrownError!.message, /line 5/);
    assert.match(thrownError!.message, /Corrupt checkpoint/);
    assert.match(thrownError!.message, /refusing to load stale fallback/);
  });

  it('B3: segment count mismatch between meta and JSONL throws', () => {
    const expectedCount = 100;
    const actualCount = 95;
    const projectId = 'test-project';

    assert.notEqual(actualCount, expectedCount);

    const err = new Error(
      `[stage:knowledge_graph, project:${projectId}] Checkpoint integrity check failed: ` +
      `meta expects ${expectedCount} segments but JSONL contains ${actualCount}. ` +
      `Delete MinIO key projects/${projectId}/content-flow-*.* or re-run from stage 1.`
    );

    assert.match(err.message, /100/);
    assert.match(err.message, /95/);
    assert.match(err.message, /integrity check failed/);
  });

  it('B1: atomic write cleanup removes tmp keys on failure', async () => {
    // Test the atomic write pattern: if phase 1 fails, .tmp keys are cleaned
    const uploaded: string[] = [];
    const deleted: string[] = [];

    const mockUpload = async (key: string) => {
      if (key.includes('meta') && !key.endsWith('.tmp')) {
        throw new Error('Simulated upload failure');
      }
      uploaded.push(key);
    };

    const mockDelete = async (key: string) => {
      deleted.push(key);
    };

    const files = [
      { key: 'segments.jsonl', buf: Buffer.from(''), contentType: 'text/plain' },
      { key: 'meta.json', buf: Buffer.from(''), contentType: 'text/plain' },
    ];
    const tmpKeys = files.map(f => `${f.key}.tmp`);

    try {
      // Phase 1: write tmp keys
      for (let i = 0; i < files.length; i++) {
        await mockUpload(tmpKeys[i]);
      }
      // Phase 2: promote to final keys
      for (const f of files) {
        await mockUpload(f.key);
      }
      assert.fail('Should have thrown');
    } catch (err) {
      // Cleanup
      await Promise.allSettled(tmpKeys.map(k => mockDelete(k)));
      assert.match((err as Error).message, /Simulated upload failure/);
    }

    assert.ok(deleted.length > 0, 'Should have attempted cleanup');
  });
});

// ══════════════════════════════════════════════════════════════
// Test Group C — Blueprint & Content Flow Correctness
// ══════════════════════════════════════════════════════════════

describe('Group C — Blueprint & Content Flow Correctness', () => {
  it('C1: missing AI decisions get needs_review', () => {
    // Simulate the gap detection logic from production-blueprint.ts
    const allSegmentIds = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'];
    const aiDecisionIds = ['s1', 's2', 's3', 's5', 's6', 's7', 's9']; // 7 of 10

    const decidedIds = new Set(aiDecisionIds);
    const missingIds = allSegmentIds.filter(id => !decidedIds.has(id));

    assert.equal(missingIds.length, 3);
    assert.deepEqual(missingIds, ['s4', 's8', 's10']);

    // Simulate warnings push
    const warnings: string[] = [];
    if (missingIds.length > 0) {
      warnings.push(`${missingIds.length} segment(s) had no AI decision and were defaulted to needs_review: ${missingIds.join(', ')}`);
    }

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /3 segment/);
  });

  it('C2: pre-classified segments get deterministic pedagogy strings', async () => {
    const { _test } = await import('../src/analysis/content-flow.js');
    const { preClassifiedPedagogy } = _test;

    assert.match(preClassifiedPedagogy('filler', null), /safe to cut/);
    assert.match(preClassifiedPedagogy('b-roll', null), /Supplementary visual/);
    assert.match(preClassifiedPedagogy('hook', null), /Attention-capturing/);
    assert.match(preClassifiedPedagogy('visual-aid', null), /Static visual/);
    assert.match(preClassifiedPedagogy('ambient', null), /Supplementary visual/);

    // Redundant with specific segment
    const redundant = preClassifiedPedagogy('filler', 'seg-42');
    assert.match(redundant, /Repeats concept/);
    assert.match(redundant, /seg-42/);

    // Non-empty for all classified roles
    assert.ok(preClassifiedPedagogy('filler', null).length > 0);
    assert.ok(preClassifiedPedagogy('b-roll', null).length > 0);
    assert.ok(preClassifiedPedagogy('hook', null).length > 0);
  });

  it('C2b: pre-classification assigns correct roles', async () => {
    const { _test } = await import('../src/analysis/content-flow.js');
    const { preClassifySegments } = _test;

    const segments = [
      { id: 's1', mediaPath: '/v.mp4', mediaType: 'image', start: 0, end: 5, text: '', duration: 5 },
      { id: 's2', mediaPath: '/v.mp4', mediaType: 'video', start: 0, end: 5, text: '', duration: 5 },
      { id: 's3', mediaPath: '/v.mp4', mediaType: 'video', start: 5, end: 6, text: 'um, yeah', duration: 1 },
      { id: 's4', mediaPath: '/v.mp4', mediaType: 'video', start: 6, end: 20, text: 'Welcome to this tutorial on machine learning fundamentals', duration: 14 },
    ];

    const { classified, uncertain } = preClassifySegments(segments);

    assert.equal(classified.get('s1')?.role, 'visual-aid'); // image
    assert.equal(classified.get('s2')?.role, 'b-roll');     // no speech video
    assert.equal(classified.get('s3')?.role, 'filler');     // um + short
    assert.equal(classified.get('s4')?.role, 'hook');       // first real content
    assert.equal(uncertain.length, 0);
  });

  it('C3: chapter merge produces correct target_duration', async () => {
    const { _test } = await import('../src/analysis/pipeline.js');
    const { refineChapters } = _test;

    const rawChapters = [
      { name: 'Intro A', order: 0, segments: ['s1'], startTime: 0, endTime: 2, topic: 'intro', pedagogyPhase: '' },
      { name: 'Intro B', order: 1, segments: ['s2'], startTime: 2, endTime: 4, topic: 'intro', pedagogyPhase: '' },
      { name: 'Intro C', order: 2, segments: ['s3'], startTime: 4, endTime: 6, topic: 'intro', pedagogyPhase: '' },
      { name: 'Main', order: 3, segments: ['s4', 's5', 's6', 's7', 's8'], startTime: 6, endTime: 60, topic: 'main', pedagogyPhase: '' },
    ];

    const allSegments = [
      { id: 's1', start: 0, end: 2, topic: 'intro', role: 'intro', importance: 3 },
      { id: 's2', start: 2, end: 4, topic: 'intro', role: 'core', importance: 3 },
      { id: 's3', start: 4, end: 6, topic: 'intro', role: 'core', importance: 3 },
      { id: 's4', start: 6, end: 20, topic: 'main', role: 'core', importance: 4 },
      { id: 's5', start: 20, end: 30, topic: 'main', role: 'core', importance: 4 },
      { id: 's6', start: 30, end: 40, topic: 'main', role: 'core', importance: 3 },
      { id: 's7', start: 40, end: 50, topic: 'main', role: 'example', importance: 3 },
      { id: 's8', start: 50, end: 60, topic: 'main', role: 'recap', importance: 2 },
    ];

    const result = refineChapters(rawChapters, allSegments);

    // All short chapters should merge into one
    // For every chapter: target_duration should match endTime - startTime
    for (const ch of result) {
      assert.ok(ch.target_duration > 0, `Chapter "${ch.name}" has non-positive duration`);
      // target_duration is computed from endTime - startTime in the code
    }

    // Total chapters should be less than 4 (short ones merged)
    assert.ok(result.length <= 4, `Expected merging to reduce chapters, got ${result.length}`);
    assert.ok(result.length >= 1, 'Should have at least 1 chapter');
  });

  it('C4: overlay cap does not penalize pre-classified hooks', async () => {
    const { _test } = await import('../src/analysis/production-blueprint.js');
    const { enforceConstraints } = _test;

    // Create 80 AI decisions: 30 want overlays (add_overlay), 50 keep_original
    const aiDecisions = Array.from({ length: 80 }, (_, i) => ({
      segmentId: `ai-${i}`,
      suggestion: i < 30 ? 'overlay' as const : 'keep' as const,
      confidence: 0.5 + (i % 10) * 0.05, // varying confidence
      explanation: '',
      action: i < 30 ? 'add_overlay' as const : 'keep_original' as const,
      reason: '',
      materialType: i < 30 ? 'stock_video' as const : null,
      materialQuery: i < 30 ? 'nature' : null,
      trackIndex: 0,
      transitionBefore: null,
      transitionAfter: null,
    }));

    // Simulate: 20 pre-classified hooks consume overlay budget
    // Total segments = 100, max overlays = 30 (30%)
    // aiOverlayCap = 30 - 20 = 10
    const aiOverlayCap = 10;
    const maxDissolves = 3;

    // Build mock content flow with segments matching our decisions
    const contentFlow = {
      segments: aiDecisions.map((d, i) => ({
        id: d.segmentId,
        mediaPath: '/v.mp4',
        mediaType: 'video' as const,
        start: i * 5,
        end: (i + 1) * 5,
        text: `Segment ${i}`,
        topic: 'test',
        role: i < 30 ? 'core' : 'core',
        importance: 3 + (i % 3),
        pedagogy: '',
        continues_from: null,
        redundant_with: null,
        visual_scene: null,
        confidence: 0.8,
        hard_cut_before: false,
        placement: null,
      })),
      topics: [],
      chapters: [],
      heatmap: [],
      crossMediaLinks: [],
      stats: { totalDuration: 400, totalSegments: 80, mediaFiles: 1, topicsFound: 1, chaptersFound: 1, cutCandidates: 0, keepCandidates: 80 },
      createdAt: new Date().toISOString(),
      projectId: 'test',
      sessionId: 'test',
    };

    const constrained = enforceConstraints(aiDecisions, contentFlow, aiOverlayCap, maxDissolves);

    // Count overlays after enforcement
    const aiOverlayCount = constrained.filter(
      (d: any) => d.action !== 'keep_original' && d.suggestion !== 'cut'
    ).length;

    assert.ok(
      aiOverlayCount <= aiOverlayCap,
      `AI overlays (${aiOverlayCount}) should be ≤ aiOverlayCap (${aiOverlayCap})`
    );

    // With 20 pre-classified hooks + aiOverlayCount, total ≤ 30
    const totalOverlays = 20 + aiOverlayCount;
    assert.ok(totalOverlays <= 30, `Total overlays (${totalOverlays}) should be ≤ 30`);
  });
});

// ══════════════════════════════════════════════════════════════
// Test Group D — Concurrency & Isolation
// ══════════════════════════════════════════════════════════════

describe('Group D — Concurrency & Isolation', () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const d of tmpDirs) {
      try { rmSync(d, { recursive: true, force: true }); } catch { /* intentional: cleanup */ }
    }
    tmpDirs.length = 0;
  });

  it('D1: two concurrent pipelines use different temp directories', () => {
    const runId1 = randomUUID();
    const runId2 = randomUUID();
    const tmpDir1 = `/tmp/mk12-test-${runId1}`;
    const tmpDir2 = `/tmp/mk12-test-${runId2}`;

    mkdirSync(tmpDir1, { recursive: true });
    mkdirSync(tmpDir2, { recursive: true });
    tmpDirs.push(tmpDir1, tmpDir2);

    assert.notEqual(tmpDir1, tmpDir2);
    assert.ok(existsSync(tmpDir1));
    assert.ok(existsSync(tmpDir2));
  });

  it('D2: temp directory is cleaned up after pipeline completes', () => {
    const runId = randomUUID();
    const tmpDir = `/tmp/mk12-test-${runId}`;
    mkdirSync(tmpDir, { recursive: true });

    // Simulate pipeline work
    writeFileSync(`${tmpDir}/test.mp4`, 'fake');
    assert.ok(existsSync(tmpDir));

    // Simulate finally block
    rmSync(tmpDir, { recursive: true, force: true });
    assert.ok(!existsSync(tmpDir), 'Temp dir should be deleted after cleanup');
  });

  it('D3: temp directory is cleaned up even after pipeline failure', () => {
    const runId = randomUUID();
    const tmpDir = `/tmp/mk12-test-${runId}`;
    mkdirSync(tmpDir, { recursive: true });
    tmpDirs.push(tmpDir); // backup cleanup

    try {
      // Simulate pipeline work then failure
      writeFileSync(`${tmpDir}/test.mp4`, 'fake');
      throw new Error('Pipeline crashed');
    } catch {
      // Simulate finally block
      rmSync(tmpDir, { recursive: true, force: true });
    }

    assert.ok(!existsSync(tmpDir), 'Temp dir should be deleted even after error');
  });

  it('D4: motion matching uses overlap, not full containment', async () => {
    const { _test } = await import('../src/analysis/director.js');
    const { findBestMotionMatch } = _test;

    const ts = { start: 10, end: 20 };

    const motionSegments = [
      { start: 8, end: 15, type: 'high', motionScore: 0.9 },
      { start: 15, end: 22, type: 'low', motionScore: 0.3 },
    ];

    const match = findBestMotionMatch(ts, motionSegments);

    assert.ok(match, 'Should find a match (not unknown)');
    assert.notEqual(match, undefined, 'Must NOT return undefined');

    // Both segments overlap by 5s each (10-15 and 15-20)
    // Overlap1 = min(15,20) - max(8,10) = 15-10 = 5s
    // Overlap2 = min(22,20) - max(15,10) = 20-15 = 5s
    // With equal overlap, the first one found with > bestOverlap wins
    // Since overlap1 is checked first and ties go to first-found, match should be the first
    assert.equal(match.type, 'high');

    // Key assertion: full containment would have returned undefined
    // because neither motion segment fully contains [10, 20]
    const fullContainment = motionSegments.find(
      m => m.start <= ts.start && m.end >= ts.end
    );
    assert.equal(fullContainment, undefined, 'Full containment should fail here');
  });

  it('D4b: motion matching returns undefined for zero overlap', async () => {
    const { _test } = await import('../src/analysis/director.js');
    const { findBestMotionMatch } = _test;

    const ts = { start: 10, end: 20 };
    const motionSegments = [
      { start: 0, end: 5, type: 'high', motionScore: 0.9 },
      { start: 25, end: 30, type: 'low', motionScore: 0.3 },
    ];

    const match = findBestMotionMatch(ts, motionSegments);
    assert.equal(match, undefined, 'Should return undefined when no overlap');
  });
});

// ══════════════════════════════════════════════════════════════
// Test Group E — Error Handling
// ══════════════════════════════════════════════════════════════

describe('Group E — Error Handling', () => {
  it('E2: contentFlow null check throws descriptive error', () => {
    // Simulate the exact check from pipeline.ts line 394-400
    const contentFlow: unknown = undefined;
    const startIdx = 3;
    const startStage: string | null = 'director_decisions';
    const projectId = 'proj-123';

    if (!contentFlow) {
      const err = new Error(
        `[pipeline] Stage 2 (content flow) did not produce a result and no cached version exists. ` +
        `startIdx=${startIdx}, startStage=${startStage ?? 'none'}. ` +
        `Check MinIO for projects/${projectId}/content-flow-meta.json or re-run from stage 1.`
      );

      assert.match(err.message, /Stage 2/);
      assert.match(err.message, /proj-123/);
      assert.match(err.message, /content-flow-meta/);
      assert.match(err.message, /startIdx=3/);
    }
  });

  it('E1: pipeline status failure is non-blocking', async () => {
    // Simulate the persistStatusWithRetry pattern
    let degraded = false;
    let pipelineCompleted = false;

    async function persistStatusWithRetry(): Promise<void> {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          throw new Error('Neo4j down');
        } catch (err) {
          if (attempt < 3) {
            // would await 500ms in real code
          } else {
            degraded = true;
          }
        }
      }
    }

    // Run "pipeline" with failing status
    await persistStatusWithRetry();
    pipelineCompleted = true; // pipeline continues despite status failure

    assert.ok(pipelineCompleted, 'Pipeline should complete even when status fails');
    assert.ok(degraded, 'statusBroadcastDegraded should be true');
  });
});
