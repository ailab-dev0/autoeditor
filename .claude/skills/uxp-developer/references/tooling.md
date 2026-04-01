# UXP Development Tooling

## UXP Developer Tool (UDT)

- **Required**: v2.2+ for Premiere Pro v25.6+
- **Install**: From Creative Cloud Desktop (search "UXP Developer Tools")
- **Admin privileges** required to run
- **Developer Mode** must be enabled: Premiere > Settings > Plugins > "Enable developer mode" > restart
- **Manual enable**: Create `/Library/Application Support/Adobe/UXP/Developer/settings.json` (macOS) or `%CommonProgramFiles%/Adobe/UXP/Developer/settings.json` (Win) with `{ "developer": true }`
- **Not available** through Adobe Admin Console for enterprise customers

### Creating from Template

1. Open UDT > Create Plugin
2. Fill: Name, Plugin ID, Host = "Adobe Premiere", Version = 25.6, Template = premierepro-quick-starter
3. Scaffolds manifest.json, index.html, index.js, README.md

### Loading Existing Plugin

1. Open Premiere (Developer Mode) + UDT
2. Click Add Plugin → browse to manifest.json
3. Click Load (or Load & Watch for auto-reload)
4. Panel appears under Window > UXP Plugins

### Debugging

- Click Debug in UDT → Chrome DevTools
- Full DOM inspection, console, network, breakpoints
- `console.log()` output appears in DevTools

### Watch Mode

- Load & Watch auto-reloads on file changes
- Manifest changes require manual unload/reload
- Bolt UXP uses own WebSocket hot reload (not UDT's watcher)

### UDT CLI

```bash
npx @adobe-uxp/devtools-cli load /path/to/manifest.json
npx @adobe-uxp/devtools-cli debug <plugin-id>
```

If using UDT CLI, connect via `chrome://inspect` with your debug port.

## Bolt UXP (Hyper Brew)

```bash
npx create-bolt-uxp       # Scaffold (or yarn/pnpm)
```

- **Frameworks**: React, Svelte, Vue
- **Bundling**: Vite-based, TypeScript, Sass
- **Hot reload**: WebSocket-based (faster than UDT file watcher)
- **Generated structure**: src/, dist/, uxp.config.ts, vite.config.ts, tsconfig.json
- **Multi-panel** support via `uxp.config.ts`
- **Theme-aware** CSS variables (light, dark, lightest, darkest)
- **GitHub Actions** CI/CD for automated CCX releases
- **Webview UI** (beta) — full HTML/CSS/JS DOM via Edge/Safari
- **Hybrid C++** plugin template support
- **Supports**: Photoshop, InDesign, Premiere Pro, Illustrator (beta)
- **License**: MIT, free for commercial use

### Commands

```bash
yarn dev                   # Hot reload development
yarn build                 # Production build
yarn ccx                   # Package for distribution
yarn zip                   # Bundle CCX with sidecar assets
```

### UDT Integration

- Add Plugin → point to dist/manifest.json → Load (**not** Load & Watch)
- Bolt uses its own WebSocket reload; UDT's watcher conflicts

## Webpack Configuration

```javascript
module.exports = {
  externals: {
    premierepro: "commonjs2 premierepro",
    uxp: "commonjs2 uxp",
  },
  // ...
};
```

- Two manifest.json files: source (for UDT loading) and distribution (build output)
- Prefer loading from source manifest during development

## TypeScript Setup

Official type definitions:
`https://github.com/AdobeDocs/uxp-premiere-pro/blob/main/src/pages/ppro_reference/types.d.ts`

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "types": ["./types.d.ts"]
  }
}
```

**Reference directive** (alternative to types array):
```typescript
/// <reference path="./types.d.ts" />
```

## CCX Packaging

1. UDT > ... menu > Package > choose output folder
2. Generates `{plugin-id}_premierepro.ccx`
3. `.ccx` = ZIP archive, no signature required (unlike `.zxp`)
4. No MXI/ExManCmd needed

### Installation

- **Double-click** the .ccx file, or
- **UPIA CLI**: `--install`, `--remove`, `--list`
- Installed plugins appear under Window > UXP Plugins

### Distribution

- **Marketplace**: Requires portal ID + approval process
- **Independent**: Direct distribution without marketplace
- Use **separate IDs** for Marketplace vs independent distribution
- Third-party .ccx installs show a warning dialog to the user

## Adobe Sample SDK

- **Repo**: `github.com/AdobeDocs/uxp-premiere-pro-samples`
- **Samples**: premiere-api (TypeScript flagship), metadata-handler (CEP port), oauth-workflow-sample
- **Build**: `cd sample-panels/premiere-api/html && npm i && npm run build`
- **Load**: Point UDT to build-html/manifest.json
