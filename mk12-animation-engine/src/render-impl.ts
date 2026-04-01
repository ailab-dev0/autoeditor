// ─── Render Implementation ──────────────────────────────────────────────────
// Shared Remotion rendering logic used by both CLI tools and the API server.

import path from "path";
import fs from "fs";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RenderOptions {
  compositionId: string;
  inputProps: Record<string, unknown>;
  durationInFrames: number;
  outputPath: string;
  fps?: number;
  width?: number;
  height?: number;
  onProgress?: (progress: number) => void;
}

// ─── Render ─────────────────────────────────────────────────────────────────

/**
 * Bundle the Remotion project and render a composition to MP4.
 *
 * This dynamically imports @remotion/bundler and @remotion/renderer
 * to avoid issues when these heavy deps aren't installed (e.g., in
 * type-checking or testing contexts).
 */
export async function renderComposition(opts: RenderOptions): Promise<string> {
  const {
    compositionId,
    inputProps,
    durationInFrames,
    outputPath,
    fps = 30,
    width = 1920,
    height = 1080,
    onProgress,
  } = opts;

  // Ensure output directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Dynamic imports to avoid requiring these at parse time
  const { bundle } = await import("@remotion/bundler");
  const { renderMedia, selectComposition } = await import("@remotion/renderer");

  // Bundle the Remotion project
  const entryPoint = path.resolve(__dirname, "index.ts");
  console.log(`[MK-12] Bundling Remotion project from ${entryPoint}...`);

  const bundled = await bundle({
    entryPoint,
    onProgress: (progress: number) => {
      if (progress % 20 === 0) {
        console.log(`[MK-12] Bundle progress: ${progress}%`);
      }
    },
  });

  // Select the composition
  const composition = await selectComposition({
    serveUrl: bundled,
    id: compositionId,
    inputProps: {
      ...inputProps,
      durationInFrames,
      fps,
    },
  });

  // Override duration if specified
  composition.durationInFrames = durationInFrames;
  composition.fps = fps;
  composition.width = width;
  composition.height = height;

  // Render to MP4
  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: {
      ...inputProps,
      durationInFrames,
      fps,
    },
    onProgress: ({ progress }) => {
      onProgress?.(progress);
    },
  });

  return outputPath;
}
