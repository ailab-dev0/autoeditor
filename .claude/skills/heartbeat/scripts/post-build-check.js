#!/usr/bin/env node

/**
 * PostToolUse hook script for heartbeat skill.
 * Detects build commands from Bash tool calls and triggers the heartbeat review.
 *
 * Reads JSON from stdin (PostToolUse hook input), checks if the command
 * was a build command, and outputs JSON to inject context back to Claude.
 */

const BUILD_PATTERNS = [
  /\bnext\s+build\b/,
  /\bnpm\s+run\s+build\b/,
  /\byarn\s+build\b/,
  /\bpnpm\s+build\b/,
  /\bbunx?\s+build\b/,
  /\btsc\b(?!\s+--noEmit)/, // tsc but not tsc --noEmit (that's a type check, not a build)
  /\bnpm\s+run\s+dev\b/,    // dev server restarts count too
  /\bnext\s+dev\b/,
];

const SERVICE_PATTERNS = [
  { pattern: /mk12-dashboard|next\s+(build|dev)/, service: 'dashboard' },
  { pattern: /mk12-backend/, service: 'backend' },
  { pattern: /remotion/, service: 'remotion' },
  { pattern: /mk12-animation-engine/, service: 'animation-engine' },
];

function detectService(command) {
  for (const { pattern, service } of SERVICE_PATTERNS) {
    if (pattern.test(command)) return service;
  }
  return null;
}

function isBuildCommand(command) {
  return BUILD_PATTERNS.some(p => p.test(command));
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  let data;
  try {
    data = JSON.parse(input);
  } catch {
    // Not valid JSON, skip
    process.exit(0);
  }

  // Only process Bash tool calls
  if (data.tool_name !== 'Bash') {
    process.exit(0);
  }

  const command = data.tool_input?.command || '';

  if (!isBuildCommand(command)) {
    process.exit(0);
  }

  // Check if the build succeeded (exit code 0)
  const response = data.tool_response;
  if (response && response.exitCode && response.exitCode !== 0) {
    // Build failed — don't run heartbeat, the user needs to fix the build first
    process.exit(0);
  }

  const service = detectService(command) || 'unknown';

  // Output JSON that injects context back to Claude
  const output = {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: [
        `[HEARTBEAT] Build completed for service: ${service}.`,
        `Run the heartbeat skill to review changes and verify correctness.`,
        `Use: /heartbeat ${service}`,
        `Focus on: type errors, runtime safety, missing imports, broken patterns.`,
      ].join('\n')
    }
  };

  console.log(JSON.stringify(output));
}

main().catch(() => process.exit(0));
