/**
 * AI Script Generator service.
 *
 * Takes an analyzed asset manifest (Qwen frame tags + Speechmatics transcript)
 * and a user's creative brief, calls Claude via OpenRouter, and returns a
 * structured EditScript for assembling a video timeline.
 */

import { config } from '../config.js';
import type { AssetManifest, MediaAsset, EditScript, TrackPlacement, ScriptTransition } from '../types/index.js';

// ──────────────────────────────────────────────────────────────────
// System prompt
// ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a professional video editor with 15 years of experience in documentary, commercial, and educational content. You think in terms of narrative arc, pacing, visual rhythm, and audience engagement.

Your task: Given a set of tagged video keyframes, audio assets, images, and a transcript, generate a complete edit script that assembles these assets into a polished final video.

Editing principles you follow:
- Hook the viewer in the first 3 seconds
- Cut on action or at natural speech breaks
- Use B-roll to cover jump cuts and illustrate key points
- Layer background audio at 20-30% volume under speech
- Place images/graphics for 2-4 seconds with subtle motion (ken-burns)
- Use cross-dissolves between scenes (0.5s), hard cuts within scenes
- Match pacing to content: fast for energy, slow for emphasis
- End with a clear conclusion or call-to-action
- Never invent assets that aren't in the available list. If the brief asks for something you don't have assets for, note it in a \`gaps\` field and work with what's available.

For each placement, include a concise \`reason\` explaining why you chose it and a human-readable \`label\` (e.g., "Interview intro", "B-roll: product closeup").

Output a structured edit script as JSON. Every placement must reference an actual asset from the available assets list. Timestamps must be valid (within asset duration). Tracks must be properly layered (V1 = primary video, V2 = overlay, A1 = primary audio, A2 = background/music).`;

// ──────────────────────────────────────────────────────────────────
// Tool schema for structured output
// ──────────────────────────────────────────────────────────────────

const EDIT_SCRIPT_TOOL = {
  type: 'function' as const,
  function: {
    name: 'generate_edit_script',
    description: 'Generate a structured edit script for assembling a video timeline from the available assets.',
    parameters: {
      type: 'object',
      required: ['narrative_structure', 'duration_estimate', 'total_cuts', 'pacing', 'tracks', 'transitions'],
      properties: {
        narrative_structure: {
          type: 'string',
          description: 'High-level description of the narrative arc and structure of the edit.',
        },
        duration_estimate: {
          type: 'number',
          description: 'Estimated total duration of the final edit in seconds (max 600).',
        },
        total_cuts: {
          type: 'integer',
          description: 'Total number of cuts/transitions in the edit.',
        },
        pacing: {
          type: 'string',
          enum: ['slow', 'moderate', 'fast', 'mixed'],
          description: 'Overall pacing of the edit.',
        },
        gaps: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of assets or content types requested in the brief but not available.',
        },
        tracks: {
          type: 'array',
          items: {
            type: 'object',
            required: ['type', 'asset', 'in', 'out', 'track', 'reason'],
            properties: {
              type: { type: 'string', enum: ['video', 'audio', 'image'] },
              asset: { type: 'string', description: 'Name of the asset from the available assets list.' },
              in: { type: 'number', description: 'Timeline in-point in seconds.' },
              out: { type: 'number', description: 'Timeline out-point in seconds.' },
              track: { type: 'string', description: 'Track assignment (V1, V2, A1, A2).' },
              reason: { type: 'string', description: 'Why this asset was placed here.' },
              label: { type: 'string', description: 'Human-readable label for this placement.' },
              source_in: { type: 'number', description: 'Source clip in-point in seconds.' },
              source_out: { type: 'number', description: 'Source clip out-point in seconds.' },
              effect: { type: 'string', description: 'Optional effect (e.g., ken-burns, slow-mo).' },
              volume: { type: 'number', description: 'Volume level 0-1 (audio tracks only).' },
            },
          },
          description: 'Ordered list of track placements that compose the timeline.',
        },
        transitions: {
          type: 'array',
          items: {
            type: 'object',
            required: ['at', 'type', 'duration'],
            properties: {
              at: { type: 'number', description: 'Timeline position of the transition in seconds.' },
              type: { type: 'string', description: 'Transition type (e.g., cross-dissolve, dip-to-black, hard-cut).' },
              duration: { type: 'number', description: 'Transition duration in seconds.' },
            },
          },
          description: 'List of transitions between placements.',
        },
      },
    },
  },
};

// ──────────────────────────────────────────────────────────────────
// User message assembly
// ──────────────────────────────────────────────────────────────────

function buildUserMessage(manifest: AssetManifest, transcript: string): string {
  const selectedAssets = manifest.assets.filter((a) => a.selected);

  let msg = `## User's Creative Brief\n${manifest.brief}\n\n## Available Assets\n`;

  for (const asset of selectedAssets) {
    msg += `### ${asset.name} (${asset.type}, ${asset.duration ?? 'unknown'}s)\n`;

    if (asset.type === 'video' && asset.keyframes?.length) {
      msg += 'Keyframe analysis:\n';
      for (const kf of asset.keyframes) {
        const tags = kf.tags?.join(', ') ?? 'none';
        const desc = kf.description ?? '';
        msg += `- [${kf.timestamp}s] Tags: ${tags} — ${desc}\n`;
      }
    }

    if (asset.type === 'audio' && asset.silenceRegions?.length) {
      const regions = asset.silenceRegions.map((r) => `[${r.start}s-${r.end}s]`).join(', ');
      msg += `Silence regions: ${regions}\n`;
    }

    if (asset.type === 'image' && asset.keyframes?.[0]) {
      const kf = asset.keyframes[0];
      const tags = kf.tags?.join(', ') ?? 'none';
      msg += `Description: ${kf.description ?? 'N/A'}, Tags: ${tags}\n`;
    }

    msg += '\n';
  }

  msg += `## Transcript\n${transcript || 'No transcript available.'}\n\n`;

  // Constraints
  const totalVideo = selectedAssets
    .filter((a) => a.type === 'video')
    .reduce((sum, a) => sum + (a.duration ?? 0), 0);
  const totalAudio = selectedAssets
    .filter((a) => a.type === 'audio')
    .reduce((sum, a) => sum + (a.duration ?? 0), 0);
  const imageCount = selectedAssets.filter((a) => a.type === 'image').length;

  msg += `## Constraints\n`;
  msg += `- Total available video duration: ${totalVideo}s\n`;
  msg += `- Total available audio duration: ${totalAudio}s\n`;
  msg += `- Available images: ${imageCount}\n`;
  msg += `- Maximum output duration: 600 seconds (10 minutes)\n`;

  return msg;
}

// ──────────────────────────────────────────────────────────────────
// OpenRouter call with tool_use
// ──────────────────────────────────────────────────────────────────

interface OpenRouterToolCallResponse {
  choices: Array<{
    message: {
      content?: string;
      tool_calls?: Array<{
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
}

async function callOpenRouterWithTools(
  systemPrompt: string,
  userMessage: string,
): Promise<EditScript> {
  if (!config.openrouterApiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not configured. Set it in your .env file to enable script generation.',
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  let res: Response;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openrouterApiKey}`,
        'HTTP-Referer': 'https://editorlens.dev',
        'X-Title': 'EditorLens MK-12',
      },
      body: JSON.stringify({
        model: config.scriptGeneratorModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        tools: [EDIT_SCRIPT_TOOL],
        tool_choice: { type: 'function', function: { name: 'generate_edit_script' } },
        max_tokens: 8192,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => 'Unknown error');
    throw new Error(`OpenRouter API error ${res.status}: ${body}`);
  }

  const data: OpenRouterToolCallResponse = await res.json();
  const choice = data.choices[0];

  if (!choice) {
    throw new Error('OpenRouter returned empty response');
  }

  // Extract tool call arguments
  const toolCall = choice.message.tool_calls?.[0];
  if (!toolCall || toolCall.function.name !== 'generate_edit_script') {
    throw new Error('OpenRouter did not return the expected tool call');
  }

  let script: EditScript;
  try {
    script = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new Error('Failed to parse edit script from AI response');
  }
  return script;
}

// ──────────────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────────────

function validateEditScript(script: EditScript, manifest: AssetManifest): string[] {
  const warnings: string[] = [];
  const assetNames = new Set(manifest.assets.map((a) => a.name));
  const assetMap = new Map(manifest.assets.map((a) => [a.name, a]));

  for (let i = 0; i < script.tracks.length; i++) {
    const placement = script.tracks[i];

    // Check asset exists
    if (!assetNames.has(placement.asset)) {
      warnings.push(`tracks[${i}]: asset "${placement.asset}" not found in manifest`);
    }

    // Check timestamps non-negative
    if (placement.in < 0) {
      warnings.push(`tracks[${i}]: in-point is negative (${placement.in})`);
    }
    if (placement.out < 0) {
      warnings.push(`tracks[${i}]: out-point is negative (${placement.out})`);
    }

    // Check out > in
    if (placement.out <= placement.in) {
      warnings.push(`tracks[${i}]: out (${placement.out}) must be > in (${placement.in})`);
    }

    // Check source_in/source_out within asset duration
    const asset = assetMap.get(placement.asset);
    if (asset?.duration != null) {
      if (placement.source_in != null && placement.source_in > asset.duration) {
        warnings.push(`tracks[${i}]: source_in (${placement.source_in}) exceeds asset duration (${asset.duration})`);
      }
      if (placement.source_out != null && placement.source_out > asset.duration) {
        warnings.push(`tracks[${i}]: source_out (${placement.source_out}) exceeds asset duration (${asset.duration})`);
      }
    }
  }

  // Check duration cap
  if (script.duration_estimate > 600) {
    warnings.push(`duration_estimate (${script.duration_estimate}) exceeds 600s cap`);
  }

  return warnings;
}

// ──────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────

/**
 * Generate an AI edit script from an asset manifest and transcript.
 *
 * Calls Claude via OpenRouter with tool_use for structured output,
 * validates the result against the manifest, and returns the script.
 */
export async function generateEditScript(
  projectId: string,
  manifest: AssetManifest,
  transcript: string,
  onProgress?: (progress: number) => void,
): Promise<EditScript> {
  console.log(`[script-gen] Starting edit script generation for project ${projectId}`);
  onProgress?.(10);

  // Build the user message from manifest + transcript
  const userMessage = buildUserMessage(manifest, transcript);
  onProgress?.(20);

  console.log(`[script-gen] Calling OpenRouter (${config.scriptGeneratorModel})...`);
  const script = await callOpenRouterWithTools(SYSTEM_PROMPT, userMessage);
  onProgress?.(80);

  // Validate
  const warnings = validateEditScript(script, manifest);
  if (warnings.length > 0) {
    console.warn(`[script-gen] Validation warnings for project ${projectId}:`);
    for (const w of warnings) {
      console.warn(`  - ${w}`);
    }
  }

  onProgress?.(100);
  console.log(
    `[script-gen] Edit script generated for project ${projectId}: ` +
    `${script.tracks.length} placements, ${script.transitions.length} transitions, ` +
    `~${script.duration_estimate}s duration, ${warnings.length} warning(s)`,
  );

  return script;
}
