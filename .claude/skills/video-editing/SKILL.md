---
name: video-editing
description: Video editing patterns for EditorLens MK-12 — Remotion animations, FFmpeg processing, auto-editor analysis, and content generation for pedagogical video production
metadata:
  tags: video, editing, remotion, ffmpeg, auto-editor, animation, content-marks, pedagogical
---

## When to use

Use this skill when working on:
- Remotion animation templates for EditorLens MK-12 content marks
- FFmpeg operations for video analysis, trimming, silence detection
- Auto-editor integration for audio/motion analysis
- Animation rendering and composition design
- Video processing pipeline stages (transcription, analysis, editing)
- Any visual content generation for the MK-12 system

## EditorLens MK-12 Animation Context

MK-12 generates animations from **content marks** — AI suggestions for what visual assets each video segment needs. The animation engine at `mk12-animation-engine/` uses Remotion to render these:

| Content Mark Type | Remotion Template | Use Case |
|-------------------|-------------------|----------|
| animation | InfoGraphic / ConceptExplainer | "VAT workflow infographic" |
| stock_video | StockFootagePlaceholder | "Professional meeting stock footage" |
| article | ArticleReference | "KPMG Financial Times article" |
| ai_image | ConceptExplainer | "AI conversation scenario" |
| speaking_only | TextOverlay (lower third) | "Speaker name and title" |
| knowledge graph | KnowledgeGraphAnim | Animated concept network |
| statistics | DataDashboard | Animated counters and charts |
| workflow | ProcessFlow | Step-by-step process animation |

## Remotion Rules

Read individual rule files for Remotion-specific patterns:

- [rules/animations.md](rules/animations.md) — Spring physics, interpolation, easing curves
- [rules/timing.md](rules/timing.md) — `spring()`, `interpolate()`, `useCurrentFrame()`
- [rules/text-animations.md](rules/text-animations.md) — Typewriter, fade-in, word-by-word reveals
- [rules/charts.md](rules/charts.md) — Bar charts, pie charts, data visualization
- [rules/compositions.md](rules/compositions.md) — Defining compositions, dynamic metadata
- [rules/sequencing.md](rules/sequencing.md) — `<Sequence>` for timeline control
- [rules/transitions.md](rules/transitions.md) — Scene transitions (fade, slide, wipe)
- [rules/3d.md](rules/3d.md) — Three.js integration for 3D content
- [rules/audio.md](rules/audio.md) — Audio import, trimming, volume control
- [rules/videos.md](rules/videos.md) — Video embedding, speed, looping
- [rules/fonts.md](rules/fonts.md) — Google Fonts and local font loading
- [rules/tailwind.md](rules/tailwind.md) — TailwindCSS in Remotion
- [rules/lottie.md](rules/lottie.md) — Lottie JSON animations
- [rules/images.md](rules/images.md) — Image embedding with `<Img>`
- [rules/ffmpeg.md](rules/ffmpeg.md) — FFmpeg for trimming, silence detection
- [rules/subtitles.md](rules/subtitles.md) — Captions and subtitle handling
- [rules/voiceover.md](rules/voiceover.md) — AI-generated voiceover
- [rules/parameters.md](rules/parameters.md) — Zod schema for parametric videos
- [rules/maps.md](rules/maps.md) — Mapbox animated maps

## MK-12 Animation Design Principles

1. **Constants-first design** — All editable values as UPPER_SNAKE_CASE constants at top of component
2. **Spring physics for everything** — Use `spring()` not CSS transitions
3. **Staggered entrances** — Elements appear one by one with delay offsets
4. **1920x1080 at 30fps** — Default output format for all MK-12 animations
5. **Brand colors** — Use theme from `mk12-animation-engine/src/styles/theme.ts`
6. **Duration from content** — Calculate based on number of items, text length, complexity

## Auto-Editor Integration

Auto-editor (Nim, at `auto-editor/`) provides:
- **Audio loudness detection** — chunk-based peak detection for silence removal
- **Motion detection** — frame-diff analysis for scene boundaries
- **Edit expression DSL** — `(or audio:0.03 motion:0.06)` for composable analysis rules
- **Timeline v3** — Multi-layer clip format with effects
- **Export** — FCP7 XML (Premiere), FCPXML (FCP/Resolve), Shotcut, Kdenlive

The backend wraps auto-editor as a subprocess for the analysis pipeline stages.
