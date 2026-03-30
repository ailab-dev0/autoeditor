# EditorLens Plugin v2 — Development Guide

## Loading in Premiere Pro

1. Build the plugin:
   ```
   npm run build
   ```

2. Open Premiere Pro (25.6+)

3. Open UXP Developer Tools:
   - Plugins → Development → UXP Developer Tool
   - Or launch the standalone UXP DevTool app

4. In UXP DevTool, click **Add Plugin** and select `dist/manifest.json`

5. Click **Load** to mount the plugin into Premiere

6. The EditorLens panels appear under Plugins menu

## Dev / Mock Mode

Mock mode lets you test the full UI flow without a running backend.

### Enable mock mode

Open the browser console in UXP DevTool (or Premiere's debug console) and run:

```js
localStorage.setItem('editorlens-dev', 'true');
```

Then reload the plugin. You'll see `[EditorLens] Dev mode — using mock transport` in the console.

### What mock mode does

- Login accepts any email/password and returns a mock JWT
- Projects list returns a single "Mock Project"
- Pipeline start simulates 5 stages over 3 seconds with progress updates
- Pipeline complete delivers a mock edit package with 4 segments:
  - **keep** (0-15s, 95% confidence) — green
  - **cut** (15-22s, 88% confidence) — red
  - **trim_start** (22-40s, 72% confidence) — yellow
  - **review** (40-55s, 60% confidence) — orange
- Stock search returns 4 placeholder results
- Transcript returns mock text
- All PATCH/POST operations succeed with canned responses

### Disable mock mode

```js
localStorage.removeItem('editorlens-dev');
```

Reload the plugin to switch back to the real backend.

## Switching Between Mock and Real Backend

| Mode | How to set | Backend required |
|------|-----------|-----------------|
| Real | `localStorage.removeItem('editorlens-dev')` | Yes — `http://localhost:8000` |
| Mock | `localStorage.setItem('editorlens-dev', 'true')` | No |

The server URL for real mode defaults to `http://localhost:8000`. Override with:

```js
localStorage.setItem('editorlens-config', JSON.stringify({ baseUrl: 'http://your-server:8000' }));
```

## Development Workflow

```
npm run dev       # webpack watch mode
npm test          # run vitest
npm run test:watch # vitest watch mode
npm run build     # production build
```

## Architecture

See `docs/superpowers/specs/2026-03-30-plugin-v2-design.md` for the full design spec.
