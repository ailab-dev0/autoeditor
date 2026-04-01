#!/usr/bin/env node
// ─── generate.ts ────────────────────────────────────────────────────────────
// CLI: Generate an animation from a content mark prompt, then render to MP4.
//
// Usage:
//   npx tsx src/generate.ts \
//     --mark '{"asset_type":"animation","search_query":"VAT workflow concept"}' \
//     --output out/vat-workflow.mp4
//
//   npx tsx src/generate.ts \
//     --type animation \
//     --query "VAT workflow concept → create motion graphic explaining VAT flow" \
//     --output out/vat.mp4
//
//   npx tsx src/generate.ts \
//     --type chapter_boundary \
//     --query "Getting Started" \
//     --chapter-number 1 \
//     --total-chapters 8 \
//     --output out/chapter1.mp4

import { Command } from "commander";
import path from "path";
import { promptToProps } from "./lib/prompt-to-props";
import { type ContentMark, type MarkType } from "./lib/content-mark-router";
import { renderComposition } from "./render-impl";

const program = new Command();

program
  .name("mk12-generate")
  .description("Generate MK-12 animation from a content mark prompt")
  .option(
    "--mark <json>",
    "Full content mark JSON object",
  )
  .option(
    "--type <type>",
    "Content mark asset_type (animation, stock_video, article, ai_image, speaking_only, chapter_boundary)",
  )
  .option("--query <query>", "Search query / prompt text")
  .option("--chapter-number <n>", "Chapter number (for chapter_boundary)", parseInt)
  .option("--total-chapters <n>", "Total chapters (for chapter_boundary)", parseInt)
  .option("--speaker <name>", "Speaker name (for speaking_only)")
  .option("--speaker-role <role>", "Speaker role (for speaking_only)")
  .option(
    "--output <path>",
    "Output file path",
    "out/animation.mp4",
  )
  .option("--duration <frames>", "Override duration in frames", parseInt)
  .option("--dry-run", "Only generate props, don't render")
  .parse();

const opts = program.opts();

async function main(): Promise<void> {
  let mark: ContentMark;

  if (opts.mark) {
    // Parse full mark JSON
    try {
      mark = JSON.parse(opts.mark);
    } catch {
      console.error("Error: --mark must be valid JSON");
      process.exit(1);
    }
  } else if (opts.type && opts.query) {
    // Build mark from individual flags
    mark = {
      asset_type: opts.type as MarkType,
      search_query: opts.query,
      chapter_number: opts.chapterNumber,
      total_chapters: opts.totalChapters,
      chapter_title: opts.type === "chapter_boundary" ? opts.query : undefined,
      speaker_name: opts.speaker,
      speaker_role: opts.speakerRole,
    };
  } else {
    console.error("Error: Provide either --mark <json> or --type <type> --query <query>");
    program.help();
    process.exit(1);
  }

  console.log(`\n[MK-12] Generating animation for: ${mark.asset_type}`);
  console.log(`[MK-12] Query: ${mark.search_query}\n`);

  // Step 1: Convert prompt to template props
  console.log("[MK-12] Converting prompt to template props...");
  const result = await promptToProps(mark);

  const durationFrames = opts.duration || result.durationFrames;

  console.log(`[MK-12] Template: ${result.compositionId}`);
  console.log(`[MK-12] Duration: ${durationFrames} frames (${(durationFrames / 30).toFixed(1)}s)`);
  console.log(`[MK-12] Props:`, JSON.stringify(result.props, null, 2));

  if (opts.dryRun) {
    console.log("\n[MK-12] Dry run complete. Skipping render.");
    return;
  }

  // Step 2: Render to MP4
  const outputPath = path.resolve(opts.output);
  console.log(`\n[MK-12] Rendering to: ${outputPath}`);

  await renderComposition({
    compositionId: result.compositionId,
    inputProps: result.props,
    durationInFrames: durationFrames,
    outputPath,
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
