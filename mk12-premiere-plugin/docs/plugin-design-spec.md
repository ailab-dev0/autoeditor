# EditorLens Plugin v2 — Complete Design Spec

## Product Overview

EditorLens is a Premiere Pro UXP panel that analyzes video content using AI and produces an intelligent edit plan. The user uploads media, the AI analyzes it, suggests edits with supporting materials (stock footage, AI images), and the user reviews/applies the decisions to their Premiere timeline.

## User Journey

```
Login → Connect → Select Project → Select Media → Analysis (auto) →
Review Blueprint → Accept/Customize → Finalize → Apply to Timeline
```

8 screens. 1 persistent status bar. 3 Premiere panels (Main, Stock, Transcript).

---

## Design System

### Colors

```
Backgrounds:
  app:          #1e1e1e    Panel background
  surface:      #2a2a2a    Cards, elevated surfaces
  hover:        #333333    Hover state
  active:       #1a3a5c    Selected/active item
  deep:         #141414    Header chrome

Text:
  primary:      #e0e0e0    Main text (10.5:1 on app bg)
  secondary:    #999999    Labels, captions
  disabled:     #666666    Disabled text
  muted:        #555555    Subtle hints

Accent:
  blue:         #4dabf7    Selection, focus, active tab, links
  blue-bg:      #1a3a5c    Selected item background

Status:
  positive:     #4caf50    Success, connected, approved, keep
  negative:     #ff4444    Error, rejected, cut
  warning:      #ff9800    Pending, connecting
  info:         #2196f3    In-progress

Roles (segment badges):
  hook:         #F1C40F    Yellow
  core:         #27AE60    Green
  filler:       #E74C3C    Red
  tangent:      #E67E22    Orange
  example:      #9B59B6    Purple
  transition:   #95A5A6    Gray
  recap:        #3498DB    Cyan
  deep-dive:    #8E44AD    Indigo

Confidence:
  high (85%+):  #27AE60    Green
  medium (50-84%): #F1C40F Yellow
  low (<50%):   #E74C3C    Red
```

### Typography

```
Font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
No Google Fonts (UXP limitation).

Scale:
  Page heading:     18px / 600 / #e0e0e0
  Section heading:  14px / 600 / #e0e0e0
  Body:             13px / 400 / #e0e0e0
  Small body:       12px / 400 / #e0e0e0
  Label:            11px / 500 / #999
  Caption:          10px / 400 / #666
  Monospace:        11px / 400 / #666 / monospace (timecodes)
```

### Spacing

```
xs:   4px     Between inline elements
sm:   6-8px   Between related items
md:   10-12px Component internal padding
lg:   16px    Section padding, page margins
xl:   24px    Major section gaps
```

### Components (UXP-safe)

```
Supported Spectrum:
  sp-button (accent, secondary, negative)
  sp-textfield (text, email, password)
  sp-progress-bar (value + indeterminate)
  sp-divider
  sp-action-button (selected state)

Custom (div-based):
  Tab bar (div buttons with bottom border)
  Status dot (8px circle span)
  Toast (positioned div with dismiss)
  Filter pills (rounded div buttons)
  Confidence bar (nested div with color fill)
  Card (bordered div with hover)
  Heatmap strip (proportional width divs)
```

### Layout

```
Panel: flex-col, min-height 100vh
  Content: flex-1, overflow-auto
  StatusBar: fixed bottom, 24px height

Card: border 1px #333, border-radius 4px, bg #2a2a2a
Selected card: border #4dabf7, bg #1a3a5c
List item: border-bottom 1px #333, padding 8-10px
```

---

## Screen 1: Login

**State:** UNAUTHENTICATED
**Entry:** Plugin loaded, no stored token

```
┌─────────────────────────────────┐
│                                 │
│         EditorLens              │  18px, #e0e0e0, center
│           v2.0                  │  10px, #555, center
│                                 │
│  ┌───────────────────────────┐  │
│  │ Server URL                │  │  Label: 12px #999
│  │ http://localhost:8000     │  │  sp-textfield, full width
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Email                     │  │
│  │ you@example.com           │  │  sp-textfield type=email
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Password                  │  │
│  │ ••••••••                  │  │  sp-textfield type=password
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │        Log In             │  │  sp-button variant=accent
│  └───────────────────────────┘  │  full width
│                                 │
│  Invalid credentials            │  #ff4444, 12px, center
│                                 │  (only when error)
├─────────────────────────────────┤
│ ● Disconnected                  │  StatusBar: red dot + text
└─────────────────────────────────┘
```

**Interactions:**
- Submit: emit auth:login → show loading on button
- Error: inline text below button, #ff4444
- Success: auto-transition to CONNECTING → READY
- Server URL saved to localStorage

---

## Screen 2: Connecting

**State:** CONNECTING
**Entry:** After login success, verifying server connection

```
┌─────────────────────────────────┐
│                                 │
│     Connecting to server...     │  14px, #e0e0e0, center
│                                 │
│  ████████████████████████████   │  sp-progress-bar indeterminate
│                                 │
│     http://localhost:8000       │  12px, #999, center
│                                 │
│  ┌───────────────────────────┐  │
│  │        Cancel             │  │  sp-button variant=secondary
│  └───────────────────────────┘  │
│                                 │
├─────────────────────────────────┤
│ ● Connecting...                 │  StatusBar: yellow dot + pulse
└─────────────────────────────────┘
```

**Interactions:**
- Cancel: back to Login
- Success: auto-transition to READY
- Timeout (10s): show error, offer retry

---

## Screen 3: Project Selector

**State:** READY
**Entry:** Authenticated + connected

```
┌─────────────────────────────────┐
│  Select Project        [+ New]  │  14px heading + accent button sm
│                                 │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │  (New project inline form,
│  │ Project name            │  │   shown when + New clicked)
│  │ [_______________] [Create]│  │  sp-textfield + sp-button
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                 │
│  ┌───────────────────────────┐  │  Project card
│  │ REST API Tutorial         │  │  13px, #e0e0e0, bold
│  │ Mar 28, 2026    ● ready  │  │  11px, #999 + green badge
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ React Hooks Deep Dive     │  │
│  │ Mar 27, 2026    ● ready  │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Docker for Beginners      │  │
│  │ Mar 25, 2026    ● error  │  │  Red badge for error
│  └───────────────────────────┘  │
│                                 │
│  ─────────────────────────────  │  sp-divider
│  ┌───────────────────────────┐  │
│  │        Log Out            │  │  sp-button variant=secondary
│  └───────────────────────────┘  │
├─────────────────────────────────┤
│ ● Connected                     │  StatusBar: green dot
└─────────────────────────────────┘
```

**Interactions:**
- Click project → fetch project data → if has edit_package → REVIEWING, else → MEDIA_SELECT
- + New → inline form appears
- Log Out → clear token → UNAUTHENTICATED
- Project status badges: ready (green), analyzing (blue), review (yellow), error (red), created (gray)

---

## Screen 4: Media Selector

**State:** MEDIA_SELECT
**Entry:** Project selected, no existing analysis

```
┌─────────────────────────────────┐
│  Select Media to Analyze        │  14px heading
│                        All None │  11px, #4dabf7 links
│                                 │
│  ┌───────────────────────────┐  │  Media item
│  │ ☑ intro.mp4              │  │  Checkbox + filename
│  │   /Users/miles/Videos/    │  │  10px, #666, path
│  │                    2:35   │  │  11px, #999, duration
│  │                   video ● │  │  10px, green badge
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ ☑ main-talk.mp4          │  │
│  │   /Users/miles/Videos/    │  │
│  │                   12:45   │  │
│  │                   video ● │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ ☐ background.mp3         │  │  Unchecked
│  │   /Users/miles/Music/     │  │
│  │                    3:20   │  │
│  │                   audio ● │  │  Blue badge for audio
│  └───────────────────────────┘  │
│                                 │
│  ─────────────────────────────  │
│  [  Back  ] [  Analyze 2 Videos ]│  secondary + accent buttons
├─────────────────────────────────┤
│ ● Connected                     │
└─────────────────────────────────┘
```

**Interactions:**
- Scans Premiere project bin for media files
- Checkbox toggle per file
- All/None quick select
- Back → READY
- Analyze → registers files → starts pipeline → WORKING
- Type badges: video (green), audio (blue), image (purple)

---

## Screen 5: Pipeline Progress

**State:** WORKING
**Entry:** Pipeline started

```
┌─────────────────────────────────┐
│  Analyzing...                   │  14px heading
│                                 │
│  ○────○────●────○────○          │  Stage dots (5)
│  Trans  KG  Chap  Prod  Done   │  9px labels under dots
│                                 │  ● = current (blue)
│                                 │  ○ done (green) / pending (gray)
│                                 │
│  ████████████████░░░░░░░░░░░░   │  sp-progress-bar value=45
│                                 │
│  Content flow analysis...       │  12px, #999, current stage msg
│                                 │
│  ~2m 15s remaining              │  12px, #999, ETA
│  Cost: $0.12                    │  12px, #999, API cost
│                                 │
│  ┌───────────────────────────┐  │
│  │        Cancel             │  │  sp-button variant=secondary
│  └───────────────────────────┘  │
├─────────────────────────────────┤
│ ● Connected                     │
└─────────────────────────────────┘
```

**Stage names (left to right):**
1. Transcription (AssemblyAI)
2. Content Flow (Claude + Qwen)
3. Chapters (refinement)
4. Production (blueprint + materials)
5. Done

**Interactions:**
- Auto-updates via WebSocket/polling
- Cancel → READY
- Complete → REVIEWING (project status = "review")

---

## Screen 6: Blueprint Review

**State:** REVIEWING
**Entry:** Pipeline complete, blueprint ready

This is the most complex screen. It has sub-tabs.

```
┌─────────────────────────────────┐
│ Segments  Stock  Transcript  Export │  Tab bar
├─────────────────────────────────┤
│                                 │
│  (Tab content below)            │
│                                 │
├─────────────────────────────────┤
│ ● Connected    3/42 reviewed    │  StatusBar + review progress
└─────────────────────────────────┘
```

### Tab: Segments (default)

```
┌─────────────────────────────────┐
│ ▓▓▓▓▓▓▓░░▓▓▓▓▓▓▓▓▓▓░▓▓▓▓▓▓▓▓ │  Heatmap strip
│ 0s                       142s   │  Duration labels
├─────────────────────────────────┤
│ All(42) Approved(5) Rejected(1) │  Filter pills
│ Pending(36) Review(0)           │
├─────────────────────────────────┤
│ 42 segs | 5 approved | 1 rej   │  Stats bar, 11px #999
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐  │  Segment card
│  │ ● Show Introduction       │  │  12px circle (role color) + topic
│  │   0.3s-1.8s  hook   95%  │  │  time + role badge + confidence
│  │   ████████████████░░  95% │  │  Confidence bar
│  │   🤖 add_text             │  │  AI suggestion
│  │                           │  │
│  │  [Accept AI] [Keep Orig]  │  │  Two buttons per segment
│  │  [Review in Browser →]    │  │  Link to dashboard
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │  Cut segment (dimmed)
│  │ ● Evolution Summary       │  │
│  │   17.5s-19.6s filler  90% │  │  Red role badge
│  │   ✂ CUT                   │  │  Red text
│  │  [Confirm Cut] [Override] │  │
│  └───────────────────────────┘  │
│                                 │
│  ... (scrollable)               │
│                                 │
├─────────────────────────────────┤
│ [Approve All] [Reject All]      │  Secondary buttons
│ [Preview Timeline (5 segs)]     │  Accent button (when approved)
│ [  Finalize & Export  ]         │  Accent button (when reviewed)
└─────────────────────────────────┘
```

**Segment card detail:**
```
┌─────────────────────────────────────┐
│ ●  Topic Name                       │  Colored dot + topic (12px bold)
│    0.3s - 1.8s   hook   imp=4      │  Timecode + role badge + importance
│    ████████████████░░  95%          │  Confidence bar
│    "Welcome to The Explainer."      │  Transcript text (12px, #ccc)
│                                     │
│  AI Director:                       │  13px, #4dabf7
│    add_text — Title overlay         │  Action + reason
│    [thumbnail if material exists]   │  Image preview
│                                     │
│  [Accept AI]  [Keep Original]       │  Two sp-buttons
│  [Review in Browser →]              │  Text link → dashboard
└─────────────────────────────────────┘
```

### Tab: Stock

```
┌─────────────────────────────────┐
│  ┌─────────────────────────┐   │
│  │ Search stock footage... │🔍 │  sp-textfield + sp-button
│  └─────────────────────────┘   │
│                                 │
│  [Pexels] [Pixabay]            │  Provider toggle pills
│                                 │
│  ┌────────┐  ┌────────┐       │  2-column grid
│  │ thumb  │  │ thumb  │       │  Image/color placeholder
│  │ Title  │  │ Title  │       │  11px, truncated
│  │ 12s px │  │ 8s  px │       │  Duration + provider
│  └────────┘  └────────┘       │
│  ┌────────┐  ┌────────┐       │
│  │ thumb  │  │ thumb  │       │
│  │ Title  │  │ Title  │       │
│  └────────┘  └────────┘       │
└─────────────────────────────────┘
```

### Tab: Transcript

```
┌─────────────────────────────────┐
│  00:00  Welcome to The Explainer│  Monospace timecode + text
│  00:04  Today we're diving into │
│  00:08  By the end, you'll have │
│  00:15  Um... let me pull up    │  (filler — could be dimmed)
│  00:18  OK so... let's skip     │
│  00:22  First thing — set up    │
│  ...                            │
│                                 │
│  ─────────────────────────────  │
│  [SRT]  [JSON]  [TXT]          │  Export format buttons
└─────────────────────────────────┘
```

### Tab: Export

```
┌─────────────────────────────────┐
│  ┌──────────┐ ┌──────────┐    │  2-column format grid
│  │Premiere  │ │DaVinci   │    │  Each: name + description
│  │Pro XML   │ │Resolve   │    │  Selected: blue border
│  └──────────┘ └──────────┘    │
│  ┌──────────┐ ┌──────────┐    │
│  │FCP XML   │ │EDL       │    │
│  └──────────┘ └──────────┘    │
│  ┌──────────┐ ┌──────────┐    │
│  │JSON      │ │CSV       │    │
│  └──────────┘ └──────────┘    │
│                                 │
│  [Export as Premiere Pro XML]   │  sp-button accent, full width
│                                 │
│  ┌───────────────────────────┐  │  (shown after export)
│  │ ✓ Export complete          │  │  Green text
│  │   premiere.xml (24.5 KB)  │  │  Filename + size
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

---

## Screen 7: Apply Summary

**State:** APPLYING
**Entry:** User finalized and applied to timeline

```
┌─────────────────────────────────┐
│                                 │
│  Timeline Updated               │  14px, #e0e0e0 (or "Applying...")
│                                 │
│  ████████████████████████████   │  sp-progress-bar (during apply)
│  12/42 operations — trim_clip   │  12px, #999
│                                 │
│  ─────────────────────────────  │
│                                 │
│  3 clips removed                │  12px, #ccc
│  2 clips trimmed                │
│  5 markers added                │
│  1 transition added             │
│                                 │
│  ✓ All operations applied       │  12px, #4caf50
│                                 │
│  [Rollback]  [Done]             │  negative + accent buttons
│                                 │
├─────────────────────────────────┤
│ ● Connected                     │
└─────────────────────────────────┘
```

**Interactions:**
- Rollback → undo all operations → back to REVIEWING
- Done → back to READY
- Error → show red text + retry option

---

## Screen 8: Status Bar (persistent)

Always visible at the bottom of every screen.

```
┌─────────────────────────────────┐
│ ● Connected          3 ⚠       │
└─────────────────────────────────┘
  ↑                      ↑
  Status dot + label     Toast count badge (red)
  (8px circle)           (only when > 0)
```

**States:**
| State | Dot color | Label |
|---|---|---|
| connected | #4caf50 | Connected |
| connecting | #ff9800 (pulse) | Connecting... |
| reconnecting | #ff9800 (pulse) | Reconnecting (2)... |
| disconnected | #ff4444 | Disconnected |

---

## Panel Architecture

3 Premiere panels, each independent Preact root:

| Panel | ID | Content | Docking |
|---|---|---|---|
| Main | editorlens.main | Full workflow (all 8 screens) | Primary |
| Stock | editorlens.stock | StockBrowser standalone | Side panel |
| Transcript | editorlens.transcript | TranscriptView standalone | Side panel |

Cross-panel sync via BroadcastChannel. All panels read same signals.

---

## User Flow Diagram

```
                    ┌──────────┐
                    │  LOGIN   │
                    └────┬─────┘
                         │ auth:login
                    ┌────▼─────┐
                    │ CONNECT  │
                    └────┬─────┘
                         │ auth:logged-in
                    ┌────▼─────┐
                    │  READY   │◄────────────────────┐
                    │ (projects)│                     │
                    └────┬─────┘                     │
                         │ project:selected          │
                    ┌────▼─────┐                     │
           ┌────────┤ PROJECT  │                     │
           │        │ LOADER   │                     │
           │        └────┬─────┘                     │
           │             │                           │
     has edit_package    │  no edit_package           │
           │             │                           │
           │        ┌────▼─────┐                     │
           │        │  MEDIA   │                     │
           │        │  SELECT  │                     │
           │        └────┬─────┘                     │
           │             │ pipeline:start             │
           │        ┌────▼─────┐                     │
           │        │ WORKING  │                     │
           │        │(pipeline)│                     │
           │        └────┬─────┘                     │
           │             │ pipeline:complete          │
           │        ┌────▼─────┐                     │
           └───────►│REVIEWING │                     │
                    │(blueprint)│                     │
                    └────┬─────┘                     │
                         │ finalize                  │
                    ┌────▼─────┐                     │
                    │ APPLYING │                     │
                    │(timeline)│                     │
                    └────┬─────┘                     │
                         │ done                      │
                         └───────────────────────────┘
```

---

## Interaction Patterns

### Segment Review Flow (in plugin)

```
1. User sees segment card with AI suggestion
2. Options:
   a. [Accept AI] → segment marked 🤖, moves to next
   b. [Keep Original] → segment marked 👤, moves to next
   c. [Review in Browser →] → opens dashboard at /project/{id}/review#{segId}
      → user makes detailed choice in browser
      → WebSocket syncs choice back to plugin
      → plugin updates segment card
3. After all segments reviewed:
   [Finalize & Export] button appears
4. Click → POST /api/projects/{id}/finalize
   → generates Premiere XML, FCPXML, EDL, CSV, JSON
   → project status = ready
5. [Apply to Timeline] → plugin uses UXP API to insert edits
```

### "Review in Browser" Link

Plugin generates URL: `http://localhost:3000/project/{projectId}/review#{segmentId}`

Opens in system browser. Dashboard page shows:
- Side-by-side: AI suggestion (left) vs Original (right)
- Material thumbnail/preview
- Alternative materials gallery
- Accept / Reject / Custom notes

Changes sync back to plugin via WebSocket in real-time.

---

## Responsive Behavior

Plugin panels resize with Premiere docking. Design for:

| Width | Layout |
|---|---|
| < 300px | Stack everything vertically, hide labels |
| 300-500px | Normal layout (designed for this range) |
| > 500px | Can show two columns for segment cards |

---

## Figma Frame Sizes

| Frame | Width | Notes |
|---|---|---|
| Main panel screens | 380px | Typical Premiere panel width |
| Stock panel | 300px | Narrow side panel |
| Transcript panel | 320px | Narrow side panel |
| Dashboard review page | 1440px | Full browser width |

---

## Component Inventory

| Component | Used In | Type |
|---|---|---|
| StatusBar | All screens | Custom div |
| TabBar | Reviewing | Custom div |
| FilterPills | Segments tab | Custom div |
| SegmentCard | Segments tab | Custom div |
| ConfidenceBar | SegmentCard | Custom div |
| HeatmapStrip | Segments tab | Custom div |
| ProjectCard | Project Selector | Custom div |
| MediaItem | Media Selector | Custom div |
| StageDots | Pipeline Progress | Custom div |
| StockCard | Stock tab | Custom div |
| TranscriptRow | Transcript tab | Custom div |
| ExportFormatCard | Export tab | Custom div |
| Toast | Global overlay | Custom div |
| LoginForm | Login | sp-textfield + sp-button |
| SearchBar | Stock tab | sp-textfield + sp-button |

---

## Data Flow

```
Plugin                          Backend                    Dashboard
  │                               │                          │
  │──── auth:login ──────────────►│                          │
  │◄─── JWT token ────────────────│                          │
  │                               │                          │
  │──── GET /projects ───────────►│                          │
  │◄─── project list ─────────────│                          │
  │                               │                          │
  │──── POST /upload (×N) ───────►│                          │
  │──── POST /pipeline/start ────►│                          │
  │                               │── Stage 1-4A ──►MinIO   │
  │◄─── WS: pipeline_status ─────│                          │
  │◄─── WS: complete (review) ───│                          │
  │                               │                          │
  │──── GET /blueprint ──────────►│◄── GET /blueprint ──────│
  │                               │                          │
  │──── PUT /blueprint/seg/X ────►│                          │
  │                               │──── WS sync ───────────►│
  │                               │                          │
  │                               │◄── PUT /blueprint/seg/X │
  │◄─── WS sync ─────────────────│                          │
  │                               │                          │
  │──── POST /finalize ──────────►│                          │
  │◄─── NLE files (MinIO URLs) ──│                          │
  │                               │                          │
  │──── Apply to Timeline ────────│                          │
  │     (UXP API transactions)    │                          │
```
