#!/usr/bin/env tsx
/**
 * End-to-end pipeline test script.
 *
 * 1. Generates a 30-second test video with FFmpeg (3 color sections + audio)
 * 2. Creates a project via the backend API
 * 3. Starts the pipeline
 * 4. Polls for completion via SSE or polling
 * 5. Prints the results (transcript, knowledge graph, segments)
 *
 * Usage:
 *   npx tsx src/test-pipeline.ts
 *
 * Prerequisites:
 *   - Backend running on http://localhost:8000
 *   - Neo4j running on bolt://localhost:7687
 *   - FFmpeg available at /opt/homebrew/bin/ffmpeg
 */

import { execSync, spawn } from 'child_process';
import { existsSync, unlinkSync } from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8000';
const FFMPEG = process.env.FFMPEG_PATH || '/opt/homebrew/bin/ffmpeg';

// ── Step 1: Generate test video ──────────────────────────────────

async function generateTestVideo(): Promise<string> {
  const videoOnly = '/tmp/mk12-test-video.mp4';
  const videoWithAudio = '/tmp/mk12-test-with-audio.mp4';

  // Clean up previous runs
  for (const f of [videoOnly, videoWithAudio]) {
    if (existsSync(f)) unlinkSync(f);
  }

  console.log('[test] Generating 30-second test video with 3 sections...');

  // Create video with 3 color sections and text overlays
  // Generate 3 color sections (no drawtext — not available on this FFmpeg build)
  execSync([
    FFMPEG,
    '-f lavfi -i "color=c=blue:s=1920x1080:r=30:d=10"',
    '-f lavfi -i "color=c=red:s=1920x1080:r=30:d=10"',
    '-f lavfi -i "color=c=green:s=1920x1080:r=30:d=10"',
    '-filter_complex "[0][1][2]concat=n=3:v=1:a=0"',
    `-y ${videoOnly}`,
  ].join(' '), { stdio: 'pipe' });

  console.log('[test] Adding silent audio track (required by Whisper)...');

  // Add a sine wave audio track so Whisper has something to process
  execSync([
    FFMPEG,
    '-f lavfi -i "sine=frequency=440:duration=30"',
    `-i ${videoOnly}`,
    '-c:v copy -c:a aac -shortest',
    `-y ${videoWithAudio}`,
  ].join(' '), { stdio: 'pipe' });

  if (!existsSync(videoWithAudio)) {
    throw new Error('Failed to generate test video');
  }

  console.log(`[test] Test video ready: ${videoWithAudio}`);
  return videoWithAudio;
}

// ── Step 2: Create project ────────────────────────────────────────

async function createProject(videoPath: string): Promise<string> {
  console.log('[test] Creating project via API...');

  const response = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Pipeline Test ${new Date().toISOString().slice(0, 19)}`,
      description: 'End-to-end pipeline test with generated video',
      video_paths: [videoPath],
      tags: ['test', 'pipeline', 'e2e'],
      brief: 'Educational video with three sections: introduction to the topic, main content explaining key concepts, and a conclusion summarizing the material.',
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to create project: ${response.status} ${body}`);
  }

  const data = await response.json() as any;
  const projectId = data.project?.id ?? data.id;
  if (!projectId) {
    throw new Error(`Unexpected create response: ${JSON.stringify(data).slice(0, 200)}`);
  }
  console.log(`[test] Project created: ${projectId}`);
  return projectId;
}

// ── Step 3: Start pipeline ────────────────────────────────────────

async function startPipeline(projectId: string): Promise<void> {
  console.log('[test] Starting pipeline...');

  const response = await fetch(`${BASE_URL}/api/projects/${projectId}/pipeline/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to start pipeline: ${response.status} ${body}`);
  }

  const data = await response.json() as any;
  console.log(`[test] Pipeline started — session: ${data.pipeline_status?.session_id}`);
}

// ── Step 4: Poll for completion ───────────────────────────────────

async function waitForCompletion(projectId: string): Promise<void> {
  console.log('[test] Waiting for pipeline to complete...');
  console.log('[test] (Polling every 3 seconds)');
  console.log('');

  const startTime = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes

  while (Date.now() - startTime < timeout) {
    await new Promise((r) => setTimeout(r, 3000));

    const response = await fetch(`${BASE_URL}/api/projects/${projectId}/pipeline/status`);
    if (!response.ok) continue;

    const data = await response.json() as any;
    const status = data.pipeline_status;

    if (!status) {
      console.log('[test]   ... no pipeline status yet');
      continue;
    }

    const currentStage = status.current_stage;
    const overall = status.overall_progress ?? 0;
    const stages = status.stages ?? [];

    // Print stage progress
    const stageInfo = stages
      .filter((s: any) => s.status !== 'pending')
      .map((s: any) => `${s.name}:${s.status}(${s.progress}%)`)
      .join(' | ');

    console.log(`[test]   [${overall}%] ${currentStage} — ${stageInfo}`);

    // Check for completion
    if (status.completed_at || overall >= 100) {
      console.log('[test] Pipeline COMPLETED!');
      return;
    }

    // Check for error
    if (status.error) {
      throw new Error(`Pipeline failed: ${status.error}`);
    }

    // Check project status
    const projectRes = await fetch(`${BASE_URL}/api/projects/${projectId}`);
    if (projectRes.ok) {
      const projData = await projectRes.json() as any;
      const proj = projData.project ?? projData;
      if (proj.status === 'ready') {
        console.log('[test] Pipeline COMPLETED (project status: ready)');
        return;
      }
      if (proj.status === 'error') {
        throw new Error('Pipeline failed (project status: error)');
      }
    }
  }

  throw new Error('Pipeline timed out after 5 minutes');
}

// ── Step 5: Print results ─────────────────────────────────────────

async function printResults(projectId: string): Promise<void> {
  console.log('');
  console.log('='.repeat(60));
  console.log(' PIPELINE RESULTS');
  console.log('='.repeat(60));

  // Get project
  const projRes = await fetch(`${BASE_URL}/api/projects/${projectId}`);
  const projData = await projRes.json() as any;
  const project = projData.project ?? projData;
  console.log(`\n  Project: ${project.name}`);
  console.log(`  Status:  ${project.status}`);

  // Get transcript
  console.log('\n--- TRANSCRIPT ---');
  const txRes = await fetch(`${BASE_URL}/api/projects/${projectId}/transcript`);
  if (txRes.ok) {
    const txData = await txRes.json() as any;
    const transcripts = txData.transcripts ?? txData ?? [];
    if (Array.isArray(transcripts) && transcripts.length > 0) {
      const t = transcripts[0];
      console.log(`  Model: ${t.model}, Language: ${t.language}`);
      console.log(`  Segments: ${t.segments?.length ?? 0}`);
      for (const seg of (t.segments ?? []).slice(0, 5)) {
        console.log(`    [${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s] ${seg.text}`);
      }
      if ((t.segments?.length ?? 0) > 5) {
        console.log(`    ... and ${t.segments.length - 5} more segments`);
      }
    } else {
      console.log('  No transcripts found');
    }
  } else {
    console.log(`  Failed to fetch transcript: ${txRes.status}`);
  }

  // Get knowledge graph
  console.log('\n--- KNOWLEDGE GRAPH ---');
  const kgRes = await fetch(`${BASE_URL}/api/projects/${projectId}/knowledge`);
  if (kgRes.ok) {
    const kgData = await kgRes.json() as any;
    const nodes = kgData.graph?.nodes ?? kgData.nodes ?? [];
    const edges = kgData.graph?.edges ?? kgData.edges ?? [];
    console.log(`  Nodes: ${nodes.length}, Edges: ${edges.length}`);
    for (const n of nodes.slice(0, 8)) {
      console.log(`    [${n.type}] ${n.label} (importance: ${n.importance}, community: ${n.community})`);
    }
    if (nodes.length > 8) {
      console.log(`    ... and ${nodes.length - 8} more concepts`);
    }
  } else {
    console.log(`  Failed to fetch knowledge graph: ${kgRes.status}`);
  }

  // Get segments
  console.log('\n--- SEGMENTS ---');
  const segRes = await fetch(`${BASE_URL}/api/projects/${projectId}/segments`);
  if (segRes.ok) {
    const segData = await segRes.json() as any;
    const segments = segData.segments ?? segData ?? [];
    console.log(`  Total: ${segments.length}`);

    // Group by decision
    const decisions: Record<string, number> = {};
    for (const seg of segments) {
      const d = seg.suggestion ?? 'unknown';
      decisions[d] = (decisions[d] ?? 0) + 1;
    }
    console.log(`  Decisions: ${JSON.stringify(decisions)}`);

    for (const seg of segments.slice(0, 5)) {
      console.log(`    [${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s] ${seg.suggestion} (${(seg.confidence * 100).toFixed(0)}%) — ${seg.explanation?.slice(0, 60)}`);
    }
    if (segments.length > 5) {
      console.log(`    ... and ${segments.length - 5} more segments`);
    }
  } else {
    console.log(`  Failed to fetch segments: ${segRes.status}`);
  }

  // Get edit package
  console.log('\n--- EDIT PACKAGE ---');
  if (project.edit_package) {
    const ep = project.edit_package;
    console.log(`  Version: ${ep.version}`);
    console.log(`  Pedagogy Score: ${ep.pedagogy_score}`);
    console.log(`  Chapters: ${ep.chapters?.length ?? 0}`);
    console.log(`  Videos: ${ep.videos?.length ?? 0}`);
    for (const ch of (ep.chapters ?? [])) {
      console.log(`    Chapter ${ch.order}: "${ch.name}" (target: ${ch.target_duration}s)`);
    }
  } else {
    console.log('  No edit package found');
  }

  console.log('\n' + '='.repeat(60));
  console.log(' TEST COMPLETE');
  console.log('='.repeat(60));
}

// ── Main ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('');
  console.log('='.repeat(60));
  console.log(' EditorLens MK-12 Pipeline — End-to-End Test');
  console.log('='.repeat(60));
  console.log('');

  // Check server is running
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    if (!healthRes.ok) throw new Error(`Server returned ${healthRes.status}`);
    const health = await healthRes.json() as any;
    console.log(`[test] Server: ${health.status}, Neo4j: ${health.neo4j}`);
  } catch (err) {
    console.error(`[test] ERROR: Cannot reach server at ${BASE_URL}`);
    console.error('[test] Make sure the backend is running: npx tsx src/server.ts');
    process.exit(1);
  }

  try {
    const videoPath = await generateTestVideo();
    const projectId = await createProject(videoPath);
    await startPipeline(projectId);
    await waitForCompletion(projectId);
    await printResults(projectId);
  } catch (err) {
    console.error('\n[test] FAILED:', (err as Error).message);
    process.exit(1);
  }
}

main();
