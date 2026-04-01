# Auto-Editor - Complete Knowledge Base

## What It Is

Auto-Editor is a CLI tool that **automatically edits video and audio files** by analyzing content and applying intelligent cuts/transformations. It removes silence, detects motion, applies speed/volume changes, and exports to professional editors.

**Written in Nim**, compiled to native code, wrapping FFmpeg for all codec/media operations.

---

## Core Workflow

```
Input File → Analysis (audio/motion/subtitle) → Boolean Mask → Timeline Build → Render or Export
```

1. **Load input** - video, audio, or timeline JSON
2. **Analyze** - chunk-based loudness detection, frame-diff motion detection, subtitle parsing
3. **Evaluate** - edit expressions combine analyses into a boolean mask per chunk
4. **Apply margin/smoothing** - extend active regions, remove tiny clips/cuts
5. **Build timeline** - v3 internal format mapping source clips to output
6. **Output** - render to media file via FFmpeg OR export to editor project format

---

## Architecture & Key Modules

```
src/
├── main.nim              # Entry point, CLI parsing
├── cli.nim               # Command definitions and option specs
├── conductor.nim         # Main editing orchestrator & timeline building
├── edit.nim              # Edit expression DSL parser & evaluator
├── editlexer.nim         # Lexer for edit syntax
├── timeline.nim          # v1, v2, v3 timeline data structures
├── av.nim                # FFmpeg wrapper (InputContainer, codec ops)
├── ffmpeg.nim            # FFmpeg C bindings
├── media.nim             # Media stream metadata extraction
├── graph.nim             # FFmpeg filter graph management
├── cache.nim             # Analysis result caching (SHA1-keyed)
│
├── analyze/
│   ├── audio.nim         # Audio loudness analysis (chunk-based peak detection)
│   ├── motion.nim        # Video motion detection (frame diff, grayscale)
│   └── subtitle.nim      # Subtitle-based detection
│
├── render/
│   ├── format.nim        # Main rendering loop (makeMedia)
│   ├── video.nim         # Video frame processing & filtering
│   ├── audio.nim         # Audio mixing & resampling
│   └── subtitle.nim      # Subtitle rendering
│
├── exports/
│   ├── fcp7.nim          # Final Cut Pro 7 XML (Premiere compatible)
│   ├── fcp11.nim         # FCPXML (FCP 11 / DaVinci Resolve)
│   ├── json.nim          # Auto-Editor timeline JSON (v1/v2/v3)
│   ├── shotcut.nim       # Shotcut MLT format
│   └── kdenlive.nim      # Kdenlive format
│
├── imports/
│   ├── fcp7.nim          # FCP7 XML importer
│   └── json.nim          # Timeline JSON importer
│
├── cmds/                 # Subcommands
│   ├── info.nim          # --info: file analysis
│   ├── cache.nim         # Cache management
│   ├── levels.nim        # --levels: show audio loudness
│   └── whisper.nim       # Speech transcription
│
└── util/
    ├── fun.nim           # Time parsing, smoothing, margin
    ├── color.nim         # Terminal color output
    ├── bar.nim           # Progress bars
    └── rules.nim         # Codec/container compatibility rules
```

---

## Key Algorithms

### Audio Loudness Detection (Silence Detection)
- **Chunk-based**: media divided into chunks based on `--frame-rate`
- **Peak detection**: each chunk's loudness = max absolute sample value across all channels
- **Resampling**: FFmpeg normalizes audio to target sample rate and int16 format
- **FIFO buffering**: consistent chunk sizes with rounding error correction
- **ARM NEON SIMD**: optimized peak detection on ARM64
- **Caching**: SHA1(filename + modtime + timebase + stream) as cache key
- **Output**: `seq[float32]` in range [0.0, 1.0]

### Motion Detection
- **Frame scaling + grayscale**: video scaled to specified width, converted to grayscale with Gaussian blur
- **Pixel difference**: each frame compared to previous; motion = percentage of changed pixels
- **Default params**: width=640, blur=5
- **Uses FFmpeg libavfilter** (scale + format + gblur)
- **Output**: `seq[float32]` in range [0.0, 1.0]

### Edit Expression DSL
- **Boolean expressions** combining detection methods
- **Operators**: `and`, `or`, `xor`, `not`
- **Methods**: `audio:threshold=VAL`, `motion:threshold=VAL`, `subtitle:...`
- **Lisp-like syntax**: `"(or audio:0.03 motion:0.06)"`
- **Output**: `seq[bool]` marking each chunk as active/inactive

### Smoothing & Margin
- **Margin**: extends active regions by specified amount (separate start/end)
- **Smoothing**: removes clips shorter than `minclip`, removes cuts shorter than `mincut`
- **Iterative**: applied until stable

---

## CLI Interface

### Basic Usage
```bash
auto-editor <input.mp4> [options]
```

### Core Options
| Option | Description | Default |
|--------|-------------|---------|
| `--edit METHOD` | Detection method | `audio` |
| `--when-silent ACTION` | Action for silent sections | `cut` |
| `--when-normal ACTION` | Action for active sections | `nil` |
| `--margin SECS` | Padding around cuts | `0.2s` |
| `--smooth MINCUT,MINCLIP` | Smooth short cuts/clips | - |
| `--cut-out RANGES` | Manually remove sections | - |
| `--add-in RANGES` | Force keep sections | - |

### Output/Export Options
| Option | Description |
|--------|-------------|
| `--output FILE` | Output path |
| `--export FORMAT` | Export to editor: `premiere`, `resolve`, `final-cut-pro`, `shotcut`, `kdenlive`, `v1`/`v2`/`v3`, `clip-sequence` |

### Rendering Options
| Option | Description |
|--------|-------------|
| `--video-codec CODEC` | Video encoder (auto-detected) |
| `--audio-codec CODEC` | Audio encoder (auto-detected) |
| `--video-bitrate RATE` | Video bitrate |
| `--audio-bitrate RATE` | Audio bitrate |
| `--audio-normalize SETTINGS` | EBU R128 or peak normalization |
| `--frame-rate NUM` | Video frame rate |
| `--sample-rate NUM` | Audio sample rate |
| `--resolution W,H` | Video resolution |
| `-vn` / `-an` | Disable video/audio |

### Subcommands
- `info <file>` - Display media file properties
- `levels <file>` - Show audio loudness over time
- `cache` - Manage analysis cache
- `whisper <file> <model>` - Speech-to-text transcription

---

## Editing Actions

When sections are marked active/inactive, these actions apply:

| Action | Description |
|--------|-------------|
| `nil` | Keep unchanged |
| `cut` | Remove completely |
| `speed:VAL` | Change speed (0.0-99999), preserves pitch via atempo |
| `varispeed:VAL` | Change speed + pitch (0.2-100) via asetrate |
| `volume:VAL` | Adjust volume (1.0 = normal) |
| `invert` | Invert video pixels |
| `zoom:VAL` | Zoom video (1.0 = no zoom) |

Actions can be chained: `speed:2,volume:0.5`

---

## Timeline Model (v3)

The internal non-linear timeline representation:

```nim
type v3 = object
  tb: AVRational          # Frame rate (e.g., 30/1)
  bg: RGBColor            # Background color
  sr: cint                # Sample rate
  layout: string          # Audio channel layout ("stereo")
  res: (int, int)         # Resolution (width, height)
  v: seq[seq[Clip]]       # Video layers
  a: seq[seq[Clip]]       # Audio layers
  s: seq[seq[Clip]]       # Subtitle layers
  langs: seq[Lang]        # Language per track
  effects: seq[Actions]   # Global effect definitions
  clips2: seq[Clip2]      # Linear representation (if linear)
```

Each **Clip** has: source file, timeline position (frames), duration (frames), source offset, effects index, stream index.

Timeline versions: **v1** (simple start/end/speed tuples) → **v2** (more metadata) → **v3** (full NLE with layers, effects, languages).

---

## Rendering Pipeline

`render/format.nim` → `makeMedia()`:

1. **Open output container** via FFmpeg (determines muxer from extension)
2. **Configure** mov flags (faststart, fragmentation)
3. **Create** video/audio output streams with specified codecs
4. **Iterate timeline** layers, decode input frames/samples
5. **Apply effects** via FFmpeg filter graphs (speed, zoom, invert, volume)
6. **Synchronize** video/audio via priority queue (heapqueue)
7. **Encode** to output format (MP4, MKV, WebM, MOV, etc.)

### Hardware Acceleration
- NVIDIA NVENC
- Apple VideoToolbox
- Intel VPL (non-macOS)

---

## Tech Stack & Dependencies

| Component | Technology |
|-----------|------------|
| Language | Nim 2.2.2+ |
| Media | FFmpeg (libavformat, libavcodec, libavutil, libswscale, libavfilter, libswresample) |
| Regex | tinyre |
| Sorting | csort |
| Hashing | nimcrypto (SHA1) |

### Optional Codecs
- VP9/VP8 (disable: `DISABLE_VPX`)
- AV1 via SVT-AV1 (disable: `DISABLE_SVTAV1`)
- HEVC/H.265 (disable: `DISABLE_HEVC`)
- 12-bit color (enable: `ENABLE_12BIT`)

---

## Key Design Patterns

1. **Chunk-based analysis**: all detection works on fixed-size chunks aligned to frame rate
2. **Expression DSL**: composable boolean logic for complex edit rules
3. **Separation of concerns**: analyze → timeline → render/export are independent phases
4. **Cache layer**: expensive analyses cached with content-aware keys
5. **Multi-format export**: single timeline model exported to many editor formats
6. **FFmpeg as engine**: all codec, filter, and container operations delegated to FFmpeg
