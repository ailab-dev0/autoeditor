# Claude Code Statusline — Design Spec

## Overview

A rich, color-coded statusline for Claude Code showing 10 metrics across 4 zones with dynamic color thresholds that shift green→yellow→red based on values.

## Layout

```
{Model} {ContextBar} {Cost} | {Branch}{Dirty} {Path} | agents:{N} tasks:{Done}/{Total} errs:{N} | {ANA Phase} {Time}
```

**4 Zones separated by dim pipe `|`:**

| Zone | Contents | Purpose |
|------|----------|---------|
| 1 | Model name, context progress bar + %, cost | Core metrics — always visible first |
| 2 | Git branch + dirty indicator, working directory | Location — where am I? |
| 3 | Agent count, task progress, error count | Activity — what's happening? |
| 4 | ANA pipeline phase, clock time | State — what phase? what time? |

## Color Palette (ANSI RGB — Vibrant/GitHub Dark)

| Element | RGB | Usage |
|---------|-----|-------|
| Gray | 139,148,158 | Model name, clock time, neutral values |
| Purple | 168,85,247 | Context bar (when static) |
| Green | 63,185,80 | Safe values, git branch clean, cost low |
| Orange | 255,166,87 | Warning values, tasks in progress, dirty indicator |
| Red | 255,123,114 | Danger values, high errors |
| Blue | 88,166,255 | Working directory path |
| Cyan | 121,192,255 | Agent count |
| Yellow | 227,179,65 | ANA pipeline phase |
| Dirty Orange | 240,136,62 | Git dirty `*` indicator |
| Dim | 48,54,61 | Pipe separators |

## Dynamic Color Thresholds

| Metric | Green (safe) | Yellow (watch) | Red (danger) |
|--------|-------------|----------------|--------------|
| Context % | 0-49% | 50-79% | 80%+ |
| Cost $ | $0-$50 | $50-$100 | $100+ |
| Errors | 0 | 1-4 | 5+ |
| Tasks | all done | in progress | — (never red) |

## Context Bar

10-block progress bar: `[██████░░░░]`
- Filled blocks: `█` (U+2588)
- Empty blocks: `░` (U+2591)
- Bar color changes with threshold (green→yellow→red)
- Percentage shown after bar: `42%`

## Metric Details

### Model (Zone 1)
- Source: `input.model.display_name`
- Color: Gray (static)
- Shortened: "Opus 4", "Sonnet 4", "Haiku 4.5"

### Context Bar (Zone 1)
- Source: `input.context_window.used_percentage`
- Dynamic color per thresholds
- Before first API call: `[░░░░░░░░░░] -`

### Cost (Zone 1)
- Source: computed from token counts with Claude Opus 4 pricing ($15/$75 per 1M in/out, $18.75 cache write, $1.50 cache read)
- Format: `$X.XX`
- Dynamic color: green <$50, yellow $50-$100, red >$100

### Git Branch + Dirty (Zone 2)
- Source: `git rev-parse --abbrev-ref HEAD` in workspace dir
- Color: Green for branch name
- Dirty indicator: Orange `*` if `git status --porcelain` has output
- Absent if not a git repo

### Path (Zone 2)
- Source: `input.workspace.current_dir` with `$HOME` replaced by `~`
- Shortened: last 2 components (e.g., `~/dev/autoeditor` → `~/autoeditor`)
- Color: Blue (static)

### Agents (Zone 3)
- Source: count `"Agent"` tool invocations in transcript file
- Color: Cyan (static)
- Format: `agents:N`

### Tasks (Zone 3)
- Source: count completed vs total tasks from transcript
- Color: Green if all done, Orange if in progress
- Format: `tasks:Done/Total`
- Shows `tasks:0/0` if no tasks

### Errors (Zone 3)
- Source: count error indicators in transcript
- Dynamic color: green at 0, yellow 1-4, red 5+
- Format: `errs:N`

### ANA Phase (Zone 4)
- Source: look for ANA phase markers in transcript (Council, SRS, RALF:CODE, RALF:TEST, etc.)
- Color: Yellow (static)
- Shows `idle` if no ANA pipeline active
- Shows `DONE` if pipeline completed

### Time (Zone 4)
- Source: `date +%H:%M`
- Color: Gray (static)

## Examples

Normal (28% context, low cost):
```
Opus 4 [███░░░░░░░] 28% $0.41 | main* ~/autoeditor | agents:3 tasks:5/8 errs:0 | RALF:CODE 14:30
```

Warning (65% context):
```
Opus 4 [██████░░░░] 65% $1.20 | feat/mk12 ~/autoeditor | agents:7 tasks:12/20 errs:3 | RALF:TEST 15:42
```

Danger (90% context, high cost):
```
Opus 4 [█████████░] 90% $105.47 | main ~/autoeditor | agents:12 tasks:20/20 errs:8 | DONE 17:03
```

Idle (no ANA, fresh session):
```
Sonnet 4 [█░░░░░░░░░] 8% $0.02 | main ~/projects/web | agents:0 tasks:0/0 errs:0 | idle 09:15
```
