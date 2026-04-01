# Remotion AI Video Generator - Complete Knowledge Base

## What It Is

An **AI-powered motion graphics generator** built as a Next.js SaaS app on top of Remotion (React-based video framework). Users type natural language prompts describing animations, AI generates React/Remotion code, which compiles and renders as live video preview. Final videos can be exported via AWS Lambda.

---

## Core Workflow

```
User Prompt → Validation → Skill Detection → LLM Code Generation →
Babel Transpilation → Live Preview → (Optional) Lambda Render to MP4
```

1. **User enters prompt** describing desired animation (+ optional image attachments)
2. **Validation** - lightweight classifier checks if prompt describes valid motion graphics
3. **Skill detection** - identifies relevant domain expertise (charts, typography, transitions, etc.)
4. **Code generation** - OpenAI gpt-5.2 generates React/Remotion component code via streaming
5. **Sanitization** - strips markdown, extracts component code
6. **Compilation** - Babel transpiles in-browser, creates executable component
7. **Preview** - `@remotion/player` renders composition in real-time
8. **Refinement** - conversation-based follow-ups apply targeted edits or full replacement
9. **Export** - optional Lambda rendering to MP4 file on S3

---

## Architecture & Key Files

```
src/
├── app/
│   ├── api/generate/          # Code generation API endpoint (streaming SSE)
│   │   └── route.ts           # POST handler: validation → skill detection → LLM → stream
│   ├── api/lambda/
│   │   ├── render/route.ts    # Trigger Lambda rendering
│   │   └── progress/route.ts  # Poll rendering progress
│   ├── generate/              # Main generation UI page
│   └── page.tsx               # Landing page
│
├── remotion/
│   ├── compiler.ts            # Babel transpilation & sandboxed code execution
│   ├── DynamicComp.tsx        # Dynamic component wrapper (delayRender/continueRender)
│   ├── Root.tsx               # Composition definition (1920x1080, 30fps, 180 frames)
│   └── webpack-override.mjs   # Custom webpack config
│
├── components/
│   ├── AnimationPlayer/       # Player controls & rendering UI
│   ├── CodeEditor/            # Monaco editor with JSX highlighting
│   ├── ChatSidebar/           # Conversation interface
│   ├── ErrorDisplay.tsx       # Error presentation
│   └── ui/                    # Radix UI primitives
│
├── hooks/
│   ├── useGenerationApi.ts    # API communication & SSE streaming
│   ├── useAutoCorrection.ts   # Error recovery (max 3 retries, AI errors only)
│   ├── useAnimationState.ts   # Code state & compilation management
│   ├── useConversationState.ts # Message history & edit tracking
│   └── useImageAttachments.ts  # Image upload management
│
├── helpers/
│   ├── sanitize-response.ts   # Markdown stripping, code extraction
│   ├── api-response.ts        # API response formatting
│   ├── capture-frame.ts       # Frame screenshot via canvas API
│   └── use-rendering.ts       # Lambda rendering orchestration
│
├── skills/                    # AI context injection modules
│   ├── index.ts               # Skill registry & detection
│   ├── charts.md              # Data visualization patterns
│   ├── typography.md          # Text animation patterns
│   ├── spring-physics.md      # Organic motion patterns
│   ├── transitions.md         # Scene transition patterns
│   ├── messaging.md           # Chat UI animation patterns
│   ├── sequencing.md          # Timing control patterns
│   ├── social-media.md        # Platform format patterns
│   └── 3d.md                  # ThreeJS integration patterns
│
├── examples/
│   └── code/                  # 9 working animation examples
│       ├── histogram.ts
│       ├── typewriter-highlight.ts
│       ├── word-carousel.ts
│       ├── text-rotation.ts
│       ├── progress-bar.ts
│       ├── gold-price-chart.ts
│       ├── animated-shapes.ts
│       ├── lottie-animation.ts
│       └── falling-spheres.ts
│
├── types/
│   ├── generation.ts          # Model IDs, stream phases
│   ├── conversation.ts        # Message structures
│   └── constants.ts           # Shared types
│
└── lambda/
    └── api.ts                 # Lambda API client
```

---

## Code Generation Pipeline

### 1. Prompt Validation
- Lightweight LLM classifier determines if prompt describes valid motion graphics
- **Accepts**: animated text, data viz, UI animations, social media content
- **Rejects**: questions, conversational requests, non-visual tasks

### 2. Skill Detection System
Analyzes prompt to identify relevant domain expertise. Two types:

| Type | Description | Example |
|------|-------------|---------|
| **Guidance Skills** | Markdown with best practices | `charts.md`, `typography.md` |
| **Example Skills** | Complete working code references | `histogram.ts`, `word-carousel.ts` |

Skills are dynamically injected into the LLM context, preventing prompt bloat by only including relevant expertise.

### 3. LLM Code Generation
- **Model**: OpenAI gpt-5.2 (with optional reasoning)
- **Streaming**: SSE events (metadata, reasoning, text-delta)
- **System prompt**: includes Remotion patterns, available APIs, constants-first design
- **Follow-up edits**: targeted search-replace operations or full code replacement

### 4. Code Sanitization
- Strips markdown code fences
- Extracts component via brace counting
- Validates structure

### 5. In-Browser Compilation
```
Generated Code → Babel Transpile (ES5) → Inject Runtime APIs → new Function() → Component
```

**Injected APIs**:
- React (hooks, JSX)
- Remotion (AbsoluteFill, spring, interpolate, useCurrentFrame, useVideoConfig, Sequence)
- @remotion/shapes (Circle, Rect, Triangle, Star, etc.)
- @remotion/transitions (TransitionSeries, fade, slide, wipe, etc.)
- @remotion/three (ThreeCanvas, useThree)
- @remotion/lottie (Lottie component)

---

## Remotion Core Concepts

### Composition Model
```tsx
<Composition
  id="DynamicComp"
  component={DynamicComp}
  durationInFrames={180}     // 6 seconds at 30fps
  fps={30}
  width={1920}
  height={1080}
  defaultProps={{ code: defaultCode }}
/>
```

### Key APIs

| API | Purpose |
|-----|---------|
| `useCurrentFrame()` | Get current frame number |
| `useVideoConfig()` | Access fps, duration, dimensions |
| `spring({ frame, fps, config })` | Physics-based easing |
| `interpolate(value, inputRange, outputRange)` | Linear value mapping |
| `AbsoluteFill` | Full-screen container |
| `Sequence` | Timeline-based child rendering with frame offset |
| `Img` | Image rendering |

### Animation Patterns

**Spring Physics Configs**:
- Snappy (UI): `{ damping: 20, stiffness: 200 }`
- Bouncy: `{ damping: 8, stiffness: 100 }`
- Smooth: `{ damping: 200, stiffness: 100 }`
- Heavy: `{ damping: 15, stiffness: 80, mass: 2 }`

**Generated Component Structure**:
```tsx
export const MyAnimation = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Constants (UPPER_SNAKE_CASE) - all editable values
  const COLORS = { background: "#000", text: "#fff" };
  const TIMING = { DURATION: 30, DELAY: 10 };

  // Calculations
  const progress = spring({ frame, fps, config: { damping: 20, stiffness: 200 } });

  // JSX
  return <AbsoluteFill style={...}>{content}</AbsoluteFill>;
};
```

---

## Player vs Renderer

| Aspect | Player (`@remotion/player`) | Renderer (`@remotion/lambda`) |
|--------|----------------------------|-------------------------------|
| **Environment** | Browser | AWS Lambda |
| **Speed** | Real-time | Minutes (distributed) |
| **Output** | Screen preview | MP4 file on S3 |
| **Quality** | Preview quality | Production quality |
| **Cost** | Free | AWS charges |
| **Use Case** | Development/preview | Distribution/export |
| **Scrubbing** | Yes | No |
| **Parallelism** | Single thread | 60 frames per Lambda worker |

### Player Usage
```tsx
<Player
  ref={playerRef}
  component={Component}
  inputProps={{ code }}
  durationInFrames={180}
  fps={30}
  width={1920}
  height={1080}
/>
```

### Lambda Rendering
```tsx
const result = await renderMediaOnLambda({
  codec: "h264",
  functionName: speculateFunctionName({...}),
  region: "us-east-1",
  serveUrl: SITE_NAME,
  composition: COMP_NAME,
  inputProps: body.inputProps,
  framesPerLambda: 60,
  downloadBehavior: { type: "download", fileName: "video.mp4" }
});
```

**Lambda Config**: Region us-east-1, RAM 3009 MB, Disk 10240 MB, Timeout 240s

---

## Error Handling & Auto-Correction

- **Auto-correction**: retries failed generations (max 3 attempts)
- **Error source tracking**: distinguishes AI-generated errors from user edits
- **Only corrects AI errors**: user edits are not auto-corrected
- **Error types**: compilation errors (Babel), runtime errors (component execution)
- **`delayRender`/`continueRender`**: handles async component initialization

---

## Follow-Up Editing

Two modes for refining generated code:

1. **Targeted Edits**: search-replace operations on specific code sections
2. **Full Replacement**: complete code regeneration when changes are too broad

The system tracks:
- Conversation history (previous prompts + responses)
- Manual edits since last generation
- Previously used skills (avoids redundant context)

---

## Tech Stack

### Core
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.7 | Full-stack React framework |
| React | 19.2.1 | UI library |
| TypeScript | 5.9.3 | Type safety |
| Remotion | 4.0.440 | React video framework |

### AI/Generation
| Technology | Purpose |
|------------|---------|
| @ai-sdk/openai | OpenAI integration |
| ai (Vercel AI SDK) | LLM streaming toolkit |
| @babel/standalone | Browser-side transpilation |

### Remotion Packages
| Package | Purpose |
|---------|---------|
| @remotion/player | Web-based video player |
| @remotion/lambda | AWS Lambda rendering |
| @remotion/shapes | Vector shapes (Circle, Rect, Star, etc.) |
| @remotion/three | Three.js 3D integration |
| @remotion/lottie | Lottie JSON animations |
| @remotion/transitions | Scene transition effects |
| @remotion/google-fonts | Font loading |
| @remotion/animated-emoji | Emoji animations |
| @remotion/paths | SVG path utilities |
| @remotion/tailwind-v4 | Tailwind CSS integration |

### UI
| Technology | Purpose |
|------------|---------|
| @monaco-editor/react | Code editor (VSCode-like) |
| @radix-ui/* | Headless UI components |
| Tailwind CSS 4.2 | Utility CSS |
| lucide-react | Icon library |

### 3D
| Technology | Purpose |
|------------|---------|
| three | 3D graphics library |
| @react-three/fiber | React Three.js renderer |

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Code generation |
| `AWS_ACCESS_KEY_ID` / `REMOTION_AWS_ACCESS_KEY_ID` | Lambda rendering |
| `AWS_SECRET_ACCESS_KEY` / `REMOTION_AWS_SECRET_ACCESS_KEY` | Lambda rendering |

---

## Key Design Patterns

1. **Skills system**: dynamic context injection prevents prompt bloat - only relevant expertise sent to LLM
2. **Streaming generation**: SSE events for real-time code display as it's generated
3. **In-browser compilation**: Babel + sandboxed execution = instant preview without server round-trip
4. **Conversation-aware editing**: tracks history, manual edits, and used skills for intelligent follow-ups
5. **Error source tracking**: distinguishes AI vs user errors for smart auto-correction
6. **Constants-first design**: generated code uses UPPER_SNAKE_CASE constants for easy tweaking
7. **Distributed rendering**: Lambda parallelism (60 frames/worker) for production export
