#!/usr/bin/env node
// ─── render.ts ──────────────────────────────────────────────────────────────
// CLI: Render a specific composition with given props to MP4.
//
// Usage:
//   npx tsx src/render.ts \
//     --comp InfoGraphic \
//     --props '{"title":"VAT Workflow","steps":[{"label":"Input"},{"label":"Output"}],"layout":"flow"}' \
//     --output out/infographic.mp4
//
//   npx tsx src/render.ts \
//     --comp ChapterTitle \
//     --props '{"chapterNumber":1,"title":"Getting Started","duration":"4:32"}' \
//     --duration 120 \
//     --output out/chapter.mp4

import { Command } from "commander";
import path from "path";
import { renderComposition } from "./render-impl";
import type { CompositionId } from "./lib/content-mark-router";

const program = new Command();

program
  .name("mk12-render")
  .description("Render an MK-12 Remotion composition to MP4")
  .requiredOption("--comp <id>", "Composition ID (InfoGraphic, TextOverlay, etc.)")
  .requiredOption("--props <json>", "Input props as JSON string")
  .option("--output <path>", "Output file path", "out/render.mp4")
  .option("--duration <frames>", "Duration in frames (overrides default)", parseInt)
  .option("--fps <n>", "Frames per second", parseInt, 30)
  .option("--width <n>", "Video width", parseInt, 1920)
  .option("--height <n>", "Video height", parseInt, 1080)
  .parse();

const opts = program.opts();

async function main(): Promise<void> {
  let inputProps: Record<string, unknown>;
  try {
    inputProps = JSON.parse(opts.props);
  } catch {
    console.error("Error: --props must be valid JSON");
    process.exit(1);
  }

  const compositionId = opts.comp as CompositionId;
  const outputPath = path.resolve(opts.output);
  const durationInFrames = opts.duration || 150;

  console.log(`\n[MK-12] Rendering composition: ${compositionId}`);
  console.log(`[MK-12] Duration: ${durationInFrames} frames (${(durationInFrames / opts.fps).toFixed(1)}s)`);
  console.log(`[MK-12] Output: ${outputPath}`);
  console.log(`[MK-12] Props:`, JSON.stringify(inputProps, null, 2));
  console.log();

  await renderComposition({
    compositionId,
    inputProps,
    durationInFrames,
    outputPath,
    fps: opts.fps,
    width: opts.width,
    height: opts.height,
    onProgress: (progress) => {
      const pct = Math.round(progress * 100);
      process.stdout.write(`\r[MK-12] Rendering: ${pct}%`);
    },
  });

  console.log(`\n\n[MK-12] Done! Output: ${outputPath}\n`);
}

main().catch((err) => {
  console.error("\n[MK-12] Fatal error:", err);
  process.exit(1);
});
