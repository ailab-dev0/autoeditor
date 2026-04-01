# ChatVideoPro — Knowledge Base

## What It Is

ChatVideoPro is an AI co-editing assistant integrated directly into Adobe Premiere Pro as a CEP (Common Extensible Platform) extension. Editors interact via conversational commands without leaving Premiere.

## Architecture
- **Platform**: CEP extension inside Premiere Pro (same extension model as EditorLens MK-12's UXP approach)
- **API**: Fal.ai for generative media operations
- **Processing**: Local machine for frame analysis, transcript segmentation, data storage
- **Privacy**: User API keys and data stored locally; only generation requests sent externally
- **Pricing**: Pay-as-you-go model

## Video Editing Tools

| Tool | Technology | What It Does | Output | Limits |
|------|-----------|-------------|--------|--------|
| **Video Canvas Editor** | Custom | Unified hub for all editing operations | — | — |
| **SAM 3 Rotoscoping** | Meta SAM 3 | Background removal, object isolation, frame-by-frame tracking | Transparent ProRes 4444 | 30s recommended |
| **Reshoot** | LTX Reshoot | Remove objects, add elements, modify scene parts | MP4 | Up to 20s |
| **Kling VFX** | Kling | Rain, fire, lighting, weather effects, character swapping | MP4 | 3-10s |
| **Video Upscaling** | Topaz / Flash VSR 2 / Bria | AI resolution enhancement | MP4/ProRes | Model-dependent |

## Image Generation

| Workflow | Models | Input |
|----------|--------|-------|
| Text-to-Image | Flux, GPT Image, Nano Banana Pro | Text prompt |
| Image-to-Image | Flux Edit | Image + prompt |
| Canvas Editor | GPT Image 1.5 | Layers, masks |
| Background Removal | Specialized models | Image |
| Image Upscaling | Topaz, Real-ESRGAN | Image |
| Thumbnail Mode | Multiple | Text/image (YouTube optimized) |

## Video Generation

| Mode | Models | Input | Use Case |
|------|--------|-------|----------|
| **Text-to-Video** | Sora 2, Veo 3.1, Kling, Hailuo, WAN | Text prompt | Create from scratch |
| **Image-to-Video** | Veo, Kling, Sora | Still image + motion description | Animate stills |
| **Transition** | Veo, Kling Transition | Start + end images | Cinematic transitions |
| **Reference** | Veo 3.1 Reference, Kling O3 | 2-7 reference images | Consistent characters |

## Specialized Assistants
- Story extraction from interview transcripts
- Color grading with technical analysis + downloadable LUT files
- Brand voice development
- Video prompting tools
- Premiere Pro troubleshooting

## Integration with Premiere Pro
- Import frames from timeline for analysis
- Export generated media directly to timeline
- Clip import/export
- Frame-level interaction

---

## Relevance to EditorLens MK-12

ChatVideoPro validates the market for AI-inside-Premiere plugins. Key differences:

| Aspect | ChatVideoPro | EditorLens MK-12 |
|--------|-------------|-------------------|
| **Extension Type** | CEP (older) | UXP (newer, recommended) |
| **Focus** | Generative media (create new content) | Pedagogical editing (analyze + restructure existing content) |
| **AI** | Fal.ai (image/video generation) | Whisper + OpenRouter Claude (transcript analysis + decisions) |
| **Knowledge Graph** | None | Neo4j concept extraction + PageRank |
| **Content Marks** | None | Asset type classification + stock footage suggestions |
| **Timeline Ops** | Basic import/export | Full marker heatmap + atomic transaction rebuild |
| **Backend** | Local processing | Dedicated server with WebSocket sync |
| **Multi-user** | Single editor | Plugin ↔ dashboard bidirectional sync |

### Integration Opportunities
1. **Fal.ai for content marks**: MK-12 content marks suggest "animation" or "ai_image" — ChatVideoPro's Fal.ai integration could generate those assets directly
2. **SAM 3 for B-roll**: When MK-12 identifies segments needing stock_video, SAM 3 rotoscoping could isolate subjects for compositing
3. **Video upscaling**: MK-12 could add an upscaling step to the export pipeline
4. **LUT generation**: Color grading analysis from ChatVideoPro could enhance MK-12's visual quality recommendations
