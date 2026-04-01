# CutOS — AI Video Editing Operating System

> Design spec for a Premiere Pro plugin + backend system that combines Qwen 3.5-0.8B (vLLM) and Claude in a dual-model consensus architecture, with Remotion-powered motion graphics generation, grounded in real mathematical and physical algorithms.

**Date:** 2026-03-28
**Status:** Design approved — pending implementation plan

---

## 1. Product Vision

A local-first AI editing assistant that lives inside Adobe Premiere Pro. It can:

1. **Autopilot** — Take raw footage and build a complete edit (cuts, pacing, titles, b-roll, graphics) after a brief interview about the user's intent
2. **Targeted actions** — Act on user-selected clips/ranges (trim, enhance, add overlays)
3. **Conversational refinement** — Iteratively adjust the edit via natural language chat
4. **Remotion generation** — Create and render motion graphics (titles, lower thirds, charts, transitions, stock composites) directly onto the timeline

**Target users:** Video editors shipping content for any platform (YouTube, TikTok, courses, corporate, cinema).
**Distribution:** Product-quality tool, potentially open-sourceable.

---

## 2. Architecture

### 2.1 Modular Monolith (Approach C)

Single Node.js/TypeScript backend with clean internal module boundaries. Remotion renders in a worker thread. vLLM runs as a sidecar process.

```
┌─────────────────┐       WebSocket        ┌──────────────────────────────────┐
│  Premiere Pro    │◄─────────────────────► │  CutOS Backend (Node.js)         │
│  UXP Plugin      │       + REST           │                                  │
│                  │                        │  ┌────────────┐ ┌─────────────┐  │
│  • Chat Panel    │                        │  │ Orchestrator│ │ AI Router   │  │
│  • Timeline API  │                        │  └────────────┘ └─────────────┘  │
│  • Preview       │                        │  ┌────────────┐ ┌─────────────┐  │
└─────────────────┘                        │  │ Analyzer    │ │ Remotion    │  │
                                           │  │ (algorithms)│ │ (worker)    │  │
                                           │  └────────────┘ └─────────────┘  │
                                           └──────────┬───────────┬───────────┘
                                                      │           │
                                              ┌───────▼──┐  ┌────▼──────┐
                                              │ vLLM     │  │ Claude    │
                                              │ Qwen 0.8B│  │ API       │
                                              └──────────┘  └───────────┘
```

### 2.2 Module Boundaries

| Module | Responsibility | Interface |
|--------|---------------|-----------|
| `orchestrator` | Session state, pipeline phases, user interaction flow | Receives commands from plugin, coordinates other modules |
| `analyzer` | Mathematical analysis of media (audio, video, motion) | Input: media file path → Output: `AnalysisReport` |
| `ai-router` | Dual-model consensus engine | Input: analysis + context → Output: `EditPlan` |
| `remotion-worker` | Renders motion graphics compositions | Input: composition spec → Output: rendered MP4 path |
| `timeline-bridge` | Translates EditPlan to Premiere UXP API calls | Input: `EditPlan` → Output: WebSocket commands to plugin |
| `stock-service` | Fetches stock footage/images from APIs | Input: search query → Output: downloaded media paths |

---

## 3. Mathematical & Physical Algorithms

Every analysis stage is grounded in established algorithms, not AI heuristics. The AI models consume these outputs — they don't replace them.

### 3.1 Audio Analysis

#### 3.1.1 Loudness Measurement (ITU-R BS.1770-4)

Perceptual loudness, not raw amplitude. Used for silence detection and normalization.

```
Algorithm: K-weighted loudness (LUFS)
1. Pre-filter: two-stage biquad (head-related shelving + high-pass)
   Stage 1 (shelving): b = [1.53512485958697, -2.69169618940638, 1.19839281085285]
                        a = [1.0, -1.69065929318241, 0.73248077421585]
   Stage 2 (high-pass): b = [1.0, -2.0, 1.0]
                         a = [1.0, -1.99004745483398, 0.99007225036621]

2. Mean square per channel: z_i = (1/N) Σ x_k²
3. Channel-weighted sum: L = -0.691 + 10·log₁₀(Σ G_i·z_i)
   Weights G: L=1.0, R=1.0, C=1.0, Ls=1.41, Rs=1.41

4. Gating:
   - Absolute gate: -70 LUFS (discard blocks below)
   - Relative gate: L_AG - 10 dB (discard blocks below)
   - Final: integrated loudness from remaining blocks
```

**Test:** Known reference signals (sine waves, pink noise) must produce LUFS values within ±0.1 dB of EBU reference implementation.

#### 3.1.2 Silence Detection

```
Algorithm: Adaptive threshold silence detection
1. Compute short-term loudness (400ms sliding window, BS.1770)
2. Compute momentary loudness (3s sliding window)
3. Silence threshold = max(absolute_floor, momentary_loudness - dynamic_range_dB)
   - absolute_floor: -50 LUFS (configurable)
   - dynamic_range_dB: 24 dB (configurable)
4. Mark regions where short-term loudness < threshold for > min_duration
   - min_duration: 300ms (configurable)
5. Extend silent regions by margin (default: 50ms each side)
6. Merge silent regions separated by < min_gap (default: 200ms)

Output: Array<{start_ms, end_ms, mean_loudness_lufs}>
```

**Test:** Synthetic audio with known silence regions (inserted at exact sample positions) must be detected with ≤ 10ms boundary error.

#### 3.1.3 Spectral Analysis (for speech vs music vs noise classification)

```
Algorithm: Short-Time Fourier Transform + feature extraction
1. STFT: window_size=2048, hop=512, window=Hann
   X[k,n] = Σ x[m]·w[m-n·hop]·e^(-j2πkm/N)

2. Feature extraction per frame:
   - Spectral centroid: Σ(f·|X(f)|) / Σ|X(f)|
   - Spectral rolloff: freq below which 85% energy concentrated
   - Zero-crossing rate: (1/2N) Σ |sign(x[n]) - sign(x[n-1])|
   - Spectral flatness: exp(mean(ln(|X|))) / mean(|X|)
     (Wiener entropy — 1.0 = white noise, 0.0 = pure tone)

3. Classification rules:
   - Speech: centroid 300-3000 Hz, ZCR 0.02-0.10, flatness < 0.3
   - Music: centroid 500-8000 Hz, ZCR < 0.05, flatness 0.1-0.5
   - Noise: flatness > 0.6
   - Silence: energy < threshold (from 3.1.2)
```

**Test:** Classification accuracy ≥ 95% on ESC-50 subset (speech/music/noise categories).

### 3.2 Video Analysis

#### 3.2.1 Scene Change Detection (histogram-based + adaptive threshold)

```
Algorithm: Dual-metric scene detection
1. Convert frame to HSV color space
2. Compute 3D histogram: H(16 bins) × S(8 bins) × V(8 bins) = 1024 bins
3. Normalize histogram to probability distribution

Metric 1 — Chi-squared distance:
   χ²(H1, H2) = Σ (H1[i] - H2[i])² / (H1[i] + H2[i])

Metric 2 — Bhattacharyya coefficient:
   BC(H1, H2) = Σ √(H1[i] · H2[i])
   Distance = √(1 - BC)

4. Scene cut detection:
   - Hard cut: χ² > μ + k·σ (k=3.0, computed over sliding window of 30 frames)
   - Gradual transition: sustained χ² > μ + 1.5·σ over > 10 frames

5. Post-processing:
   - Minimum scene length: 0.5s (reject false positives from flash frames)
   - Merge rapid cuts within 0.3s (likely same scene)

Output: Array<{frame, timestamp_ms, type: 'hard_cut'|'dissolve'|'fade', confidence}>
```

**Test:** Precision ≥ 0.92, Recall ≥ 0.88 on BBC Planet Earth test set (manually annotated).

#### 3.2.2 Motion Intensity (optical flow magnitude)

```
Algorithm: Farneback dense optical flow
1. Build polynomial expansion at each pixel:
   f(x) ≈ x^T A x + b^T x + c  (quadratic approximation)

2. Displacement field from two consecutive polynomial expansions:
   d = -(A1 + A2)^(-1) · (b2 - b1) / 2

3. Motion intensity per frame:
   I = mean(||d(x,y)||₂) across all pixels

4. Temporal smoothing: Gaussian filter (σ = 3 frames)

5. Normalization: I_norm = (I - I_min) / (I_max - I_min) per scene

Output: Array<{frame, timestamp_ms, intensity: 0.0-1.0, dominant_direction: {dx, dy}}>
```

**Why Farneback over Lucas-Kanade:** Dense flow captures global motion (camera movement, crowd scenes), not just sparse feature points. The 0.8B model can't see frames — motion intensity is a critical input.

**Test:** Synthetic sequences with known displacement fields (translation, rotation, zoom) must match ground truth within 5% RMSE.

#### 3.2.3 Visual Complexity (information-theoretic)

```
Algorithm: Frame entropy + edge density
1. Spatial entropy (Shannon):
   H = -Σ p(i)·log₂(p(i))  where p(i) = grayscale histogram / N_pixels
   Range: 0 (solid color) to 8 (maximum complexity for 8-bit)

2. Edge density (Canny):
   - Gaussian blur (σ=1.4)
   - Sobel gradients (Gx, Gy)
   - Non-maximum suppression
   - Hysteresis thresholding (low=50, high=150)
   - Edge density = edge_pixels / total_pixels

3. Combined complexity:
   C = α·H_norm + β·E_norm  (α=0.6, β=0.4)
   where H_norm = H/8, E_norm = edge_density

Output: Array<{frame, timestamp_ms, entropy, edge_density, complexity: 0.0-1.0}>
```

**Use:** Complex frames need more screen time. The pacing algorithm (3.4.1) uses complexity to determine minimum display duration.

**Test:** Known test images (solid black → white noise → natural scenes) must produce monotonically increasing complexity scores.

### 3.3 Transcript Analysis

#### 3.3.1 Sentence Boundary Detection

```
Algorithm: CRF-based sentence segmentation on Whisper output
1. Whisper provides word-level timestamps: [{word, start, end, confidence}]
2. Features per word boundary:
   - Pause duration (gap between consecutive words)
   - Pitch reset (F0 contour drop, computed via autocorrelation)
   - Word-final punctuation probability (from language model)
   - Whisper segment boundary alignment
3. CRF labels: B (boundary) / I (internal)
4. Post-processing: merge sentences < 3 words into neighbors

Output: Array<{text, start_ms, end_ms, words: [{word, start, end}]}>
```

#### 3.3.2 Topic Segmentation (TextTiling)

```
Algorithm: TextTiling (Hearst, 1997) adapted for spoken content
1. Tokenize transcript into pseudo-sentences (from 3.3.1)
2. Create token-sequences of width w=20 words
3. Compute block similarity using cosine similarity:
   sim(b1, b2) = (b1 · b2) / (||b1|| · ||b2||)
   where b1, b2 are tf-idf vectors of adjacent blocks

4. Depth score at each gap:
   depth(i) = (peak_left(i) - sim(i)) + (peak_right(i) - sim(i))

5. Topic boundary at gaps where depth > μ + σ/2

Output: Array<{topic_start_ms, topic_end_ms, summary, key_terms[]}>
```

**Test:** Topic boundaries must align with manual chapter markers within ±5 seconds on a test corpus of 20 educational videos.

### 3.4 Pacing & Rhythm

#### 3.4.1 Attention Curve Model

```
Algorithm: Exponential decay attention with stimulus reset
Based on: Cognitive load theory (Sweller) + YouTube retention curves

1. Base attention: A(t) = A₀ · e^(-λt)
   - A₀ = 1.0 (full attention at start)
   - λ = decay rate (platform-dependent):
     YouTube long-form: λ = 0.003/s
     Short-form/Reels:  λ = 0.015/s
     Educational:       λ = 0.005/s

2. Stimulus events reset attention:
   - Scene change: A → min(A + 0.3, 1.0)
   - New speaker: A → min(A + 0.2, 1.0)
   - Motion spike: A → min(A + intensity × 0.15, 1.0)
   - Graphic/title: A → min(A + 0.25, 1.0)
   - Topic change: A → min(A + 0.4, 1.0)

3. Pacing rule: if A(t) < A_threshold, inject a stimulus
   - A_threshold = 0.4 (configurable)
   - Minimum inter-stimulus interval: 3s
   - Stimulus selection priority: cut > graphic > b-roll > transition

Output: attention_curve: Array<{timestamp_ms, attention: 0.0-1.0}>
        stimulus_suggestions: Array<{timestamp_ms, type, reason}>
```

**Test:** Generated attention curves must correlate (Pearson r ≥ 0.7) with actual YouTube retention data on a test set of 10 videos with known analytics.

#### 3.4.2 Cut Rhythm (perceptual timing)

```
Algorithm: Musical meter-aligned cutting
1. Beat detection via onset detection:
   - Spectral flux: SF(n) = Σ max(|X(n,k)| - |X(n-1,k)|, 0)
   - Peak picking with adaptive threshold

2. Tempo estimation:
   - Autocorrelation of onset detection function
   - Dominant period → BPM

3. Cut placement preference:
   - On-beat cuts feel rhythmic (weight: 1.0)
   - Off-beat cuts feel jarring (weight: 0.3)
   - Downbeat cuts feel structural (weight: 1.5)

4. When no music: use speech rhythm instead
   - Sentence boundaries as "beats"
   - Paragraph/topic boundaries as "downbeats"

Output: beat_grid: Array<{timestamp_ms, strength: 0.0-1.0, is_downbeat: bool}>
```

**Test:** Beat detection accuracy ≥ 90% on MIREX beat tracking dataset subset.

### 3.5 Color Science

#### 3.5.1 Shot Consistency (for B-roll matching)

```
Algorithm: Perceptual color distance in CIELAB space
1. Convert frame to CIELAB (through sRGB → XYZ → Lab)
   L* = 116·f(Y/Yn) - 16
   a* = 500·[f(X/Xn) - f(Y/Yn)]
   b* = 200·[f(Y/Yn) - f(Z/Zn)]
   where f(t) = t^(1/3) if t > (6/29)³, else (29/6)²·t/3 + 4/29

2. Color palette extraction: k-means (k=5) on Lab values
3. Distance between shots: Earth Mover's Distance between palettes
   EMD(P, Q) = min_{F} Σ f_ij · d_ij / Σ f_ij
   where d_ij = ΔE*₀₀ (CIEDE2000 perceptual difference)

4. Match score: 1.0 - EMD/max_EMD

Output: palette: Array<{L, a, b, weight}>, match_score: 0.0-1.0
```

**Use:** When placing B-roll or stock footage, match color temperature and palette to surrounding shots.

**Test:** Perceptually similar shots (judged by 5 human raters) must score > 0.7; dissimilar < 0.3.

---

## 4. Dual-Model Consensus Engine

### 4.1 Architecture

Both Qwen 3.5-0.8B (via vLLM) and Claude evaluate every decision independently. Their confidence scores are weighted-merged. The merged score must reach a threshold to auto-execute.

### 4.2 Consensus Formula

```
merged_confidence = 0.3 × conf_qwen + 0.7 × conf_claude
```

### 4.3 Adaptive Thresholds by Decision Type

| Decision Type | Threshold | Rationale |
|---------------|-----------|-----------|
| Silence trimming | 88% | Both models reliable on clear signal |
| Scene boundary cuts | 90% | Well-defined by histogram analysis |
| Clip duration/trim | 93% | Requires some judgment |
| Clip ordering | 95% | Narrative structure is subjective |
| Creative/pacing | 95% | Highly subjective |
| Graphics placement | 96% | Contextual, easy to get wrong |

### 4.4 Decision Protocol

1. Both models receive the same `AnalysisReport` + `ProjectBrief`
2. Each returns `{action, confidence, reasoning}`
3. If actions **disagree** → auto-flag for user, regardless of confidence
4. If actions **agree** → compute `merged_confidence`
5. If `merged_confidence ≥ threshold[decision_type]` → auto-execute
6. If below threshold → flag for user with context and both models' reasoning

### 4.5 Calibration Phase

First 500 decisions of a new installation run in "supervised mode":
- All decisions are shown to user (even high-confidence ones)
- User accept/reject rate is logged
- Beta distribution parameters for each model's confidence-when-correct and confidence-when-wrong are fitted from real data
- Thresholds auto-adjust to maintain ≤ 1/1000 false flag rate

### 4.6 Mathematical Guarantee

From the analysis in Section 3 of the brainstorm:

```
P(wrong | auto-executed) = P(both wrong) × P(M≥T | both wrong)
                           ─────────────────────────────────────────
                           P(both correct)×P(M≥T | both correct) + P(both wrong)×P(M≥T | both wrong)
```

At T=0.93, baseline assumptions:
- P(both wrong) = 0.0252
- P(M≥T | both wrong) requires both models in extreme overconfidence tails simultaneously
- Result: ≤ 1.0 per 1,000 auto-executed decisions

---

## 5. Pipeline Phases

### Phase 1: Interview

Claude drives a 3-5 question conversation in the plugin chat panel:
- Content type (educational, vlog, podcast, corporate, short-form)
- Target platform and duration
- Pacing preference (fast/moderate/slow)
- Style (minimal/energetic/cinematic/professional)
- Special requirements (brand colors, logo, specific graphics)

Output: `ProjectBrief` JSON

### Phase 2: Analysis

Backend analyzes raw footage using algorithms from Section 3, all in parallel:

| Analysis | Algorithm | Output |
|----------|-----------|--------|
| Audio loudness | BS.1770-4 (§3.1.1) | LUFS curve |
| Silence regions | Adaptive threshold (§3.1.2) | Silent segments |
| Audio classification | STFT features (§3.1.3) | Speech/music/noise labels |
| Scene changes | Chi-squared + Bhattacharyya (§3.2.1) | Cut points |
| Motion intensity | Farneback optical flow (§3.2.2) | Motion curve |
| Visual complexity | Entropy + Canny (§3.2.3) | Complexity curve |
| Transcript | Whisper + CRF (§3.3.1) | Word-level timestamps |
| Topics | TextTiling (§3.3.2) | Topic segments |
| Beat grid | Onset detection (§3.4.2) | Beat timestamps |
| Color palettes | CIELAB k-means (§3.5.1) | Per-scene palettes |

Output: `AnalysisReport` — all analysis results combined into a single structured document.

### Phase 3: Decision Engine

The `AnalysisReport` + `ProjectBrief` are sent to both models via `ai-router`. The consensus engine (Section 4) produces an `EditPlan`:

```typescript
interface EditPlan {
  tracks: TrackSpec[];
  cuts: CutDecision[];
  graphics: GraphicSpec[];       // Remotion compositions to render
  stock_requests: StockQuery[];  // B-roll / stock footage to fetch
  transitions: TransitionSpec[];
  audio_adjustments: AudioAdjustment[];
  pacing_notes: string;          // Claude's narrative reasoning
}
```

### Phase 4: Render & Place

1. **Remotion worker** renders all `GraphicSpec` items → MP4 clips
2. **Stock service** fetches and downloads matching footage
3. **Timeline bridge** translates `EditPlan` to Premiere UXP commands
4. Plugin executes on the timeline via WebSocket command stream

### Phase 5: Conversational Refinement

User reviews the assembled timeline in Premiere. Chats to refine. Each refinement request goes through the same consensus engine — quick fixes (trim 2s) may hit the fast path, creative changes (restructure intro) go through full analysis.

---

## 6. Plugin Architecture (UXP)

### 6.1 Panels

| Panel | Purpose |
|-------|---------|
| **Chat** | Conversational interface, interview, refinement commands |
| **Status** | Pipeline progress, analysis results, confidence scores |
| **Graphics** | Browse/preview Remotion compositions before placing |

### 6.2 Timeline API Integration

Key UXP APIs used:
- `app.project.activeSequence` — read/modify timeline
- `ProjectItem.createBin()` — organize imported media
- `Sequence.insertClip()` — place clips on timeline
- `Track.overwriteClip()` — precise placement
- `ProjectItem.setInPoint/setOutPoint()` — trim clips

### 6.3 Communication Protocol

WebSocket between plugin and backend:

```typescript
// Plugin → Backend
type PluginMessage =
  | { type: 'start_autopilot', media_paths: string[] }
  | { type: 'chat', message: string }
  | { type: 'selection', in_point: number, out_point: number, track: number }
  | { type: 'approve_decision', decision_id: string }
  | { type: 'reject_decision', decision_id: string, reason?: string }

// Backend → Plugin
type BackendMessage =
  | { type: 'phase_update', phase: 1|2|3|4|5, progress: number }
  | { type: 'decision_request', decision_id: string, description: string, options: Option[] }
  | { type: 'execute', commands: TimelineCommand[] }
  | { type: 'chat_response', message: string }
  | { type: 'render_complete', graphic_id: string, media_path: string }
```

---

## 7. Remotion Integration

### 7.1 Composition Types

| Type | Description | Inputs |
|------|-------------|--------|
| `TitleCard` | Full-screen title with animation | text, style, duration |
| `LowerThird` | Name/title overlay | name, title, position, style |
| `ChapterMarker` | Section divider | chapter_name, number |
| `DataChart` | Animated chart (bar, line, pie) | data, chart_type, colors |
| `TextOverlay` | Callout, annotation, subtitle | text, position, style |
| `TransitionWipe` | Custom transition between scenes | type, duration, direction |
| `StockComposite` | Stock footage with blend/overlay | stock_path, blend_mode, opacity |
| `KenBurns` | Animated pan/zoom on still image | image_path, start_rect, end_rect |

### 7.2 Rendering Pipeline

1. Claude generates Remotion composition code from the `GraphicSpec`
2. Code is validated (syntax check, safety sandbox)
3. Worker thread renders via `@remotion/renderer` → MP4
4. Rendered clip is imported into Premiere project
5. Plugin places it on the designated track at the specified time

### 7.3 Style System

Each `ProjectBrief` generates a `StyleConfig` that all compositions inherit:
- Color palette (primary, secondary, accent, background)
- Typography (font family, weights, sizes)
- Animation easing (spring physics parameters)
- Motion intensity (subtle → dramatic)

---

## 8. Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Backend | Node.js + TypeScript + Fastify | Fast, typed, Remotion-compatible |
| Plugin | UXP + TypeScript | Premiere Pro standard |
| AI (fast) | Qwen 3.5-0.8B via vLLM | Local, fast, cheap |
| AI (smart) | Claude API (Sonnet/Opus) | Creative reasoning |
| Graphics | Remotion 4.x (worker thread) | React-based video, programmable |
| Audio analysis | FFmpeg + custom (BS.1770) | Industry standard |
| Video analysis | FFmpeg + OpenCV.js | Dense optical flow |
| Transcript | Whisper (via auto-editor or API) | Best-in-class STT |
| Stock | Pexels + Pixabay APIs | Free, high-quality |
| Communication | WebSocket (ws) | Bidirectional, real-time |
| Testing | Vitest + synthetic media | TDD with known-answer tests |

---

## 9. Testing Strategy (TDD)

Every module is test-first. Three categories:

### 9.1 Algorithm Tests (deterministic)

Each algorithm from Section 3 has tests against known-answer inputs:

| Algorithm | Test Method |
|-----------|------------|
| BS.1770 loudness | Reference sine waves → expected LUFS ±0.1 dB |
| Silence detection | Synthetic audio with inserted silence → exact boundary match ±10ms |
| Scene detection | Synthetic video (color changes at known frames) → exact frame match |
| Optical flow | Synthetic translation/rotation → displacement vector match ±5% |
| Visual complexity | Solid → noise → natural → monotonically increasing |
| Beat detection | Metronome audio at known BPM → BPM match ±1 |
| Color distance | Known Lab colors → exact ΔE*₀₀ values |
| Attention model | Known stimulus sequence → expected curve values |

### 9.2 Integration Tests

- Full pipeline: raw media file → `AnalysisReport` (check all fields populated, consistent timestamps)
- Consensus engine: mocked model responses → correct merge + threshold behavior
- Remotion render: composition spec → valid MP4 output (correct duration, resolution)
- WebSocket protocol: command sequences → expected plugin state changes

### 9.3 Calibration Tests

- Consensus false flag rate: Monte Carlo with fitted Beta distributions from production logs
- Adaptive threshold convergence: simulated calibration phase reaches target rate within 500 decisions

---

## 10. Data Structures

### 10.1 Core Types

```typescript
interface ProjectBrief {
  content_type: 'educational' | 'vlog' | 'podcast' | 'corporate' | 'short_form' | 'cinematic';
  target_platform: 'youtube' | 'tiktok' | 'instagram' | 'course' | 'general';
  target_duration_s?: number;
  pacing: 'fast' | 'moderate' | 'slow';
  style: 'minimal' | 'energetic' | 'cinematic' | 'professional';
  brand?: { colors: string[]; logo_path?: string; font?: string };
}

interface AnalysisReport {
  source_file: string;
  duration_ms: number;
  fps: number;
  resolution: { width: number; height: number };
  audio: {
    loudness_curve: TimeSeries;       // LUFS over time
    silence_regions: TimeRegion[];
    classification: ClassifiedRegion[]; // speech/music/noise
    beat_grid: Beat[];
  };
  video: {
    scene_changes: SceneChange[];
    motion_curve: TimeSeries;
    complexity_curve: TimeSeries;
    color_palettes: ScenePalette[];
  };
  transcript: {
    sentences: Sentence[];
    topics: Topic[];
  };
}

interface ConsensusResult {
  decision_id: string;
  decision_type: DecisionType;
  action: string;
  qwen_response: { action: string; confidence: number; reasoning: string };
  claude_response: { action: string; confidence: number; reasoning: string };
  merged_confidence: number;
  threshold: number;
  auto_executed: boolean;
  user_override?: { accepted: boolean; reason?: string };
}

interface EditPlan {
  tracks: TrackSpec[];
  cuts: CutDecision[];
  graphics: GraphicSpec[];
  stock_requests: StockQuery[];
  transitions: TransitionSpec[];
  audio_adjustments: AudioAdjustment[];
  attention_curve: TimeSeries;
  pacing_notes: string;
}
```

---

## 11. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Analysis of 10min video | < 60s on M-series Mac |
| Qwen inference latency | < 200ms per decision (vLLM) |
| Claude inference latency | < 3s per decision |
| Remotion render (10s clip) | < 15s |
| End-to-end autopilot (10min video) | < 5 minutes |
| False flag rate | ≤ 1/1000 auto-executed decisions |
| Plugin ↔ backend latency | < 50ms (local WebSocket) |
| Memory usage (backend) | < 2GB (excluding vLLM) |
| vLLM VRAM usage | < 2GB (0.8B model) |

---

## 12. Scope Boundaries

**In scope:**
- Premiere Pro plugin with chat, status, and graphics panels
- Backend with all analysis algorithms, consensus engine, Remotion rendering
- vLLM sidecar setup for Qwen 3.5-0.8B
- Stock footage integration (Pexels/Pixabay)
- Calibration system for consensus thresholds
- TDD test suite for all algorithms

**Out of scope (future):**
- DaVinci Resolve / Final Cut Pro support
- Cloud rendering (AWS Lambda for Remotion)
- Multi-user collaboration
- Mobile companion app
- Training custom Qwen fine-tune on editing decisions
- Real-time preview of AI decisions before execution
