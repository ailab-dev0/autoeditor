# UXP Development Tooling

## UXP Developer Tool (UDT)

- **Required**: v2.2+ for Premiere Pro v25.6+
- **Admin privileges** required to run
- **Features**: Plugin loading, hot reload (file watcher), Chrome DevTools-like debugger, console, elements inspector, network monitor, CCX packaging, code playground
- **Developer Mode**: Must be enabled in both UDT and Premiere Pro settings
- **Manual enable**: Create `/Library/Application Support/Adobe/UXP/Developer/settings.json` (macOS) or `%CommonProgramFiles%/Adobe/UXP/Developer/settings.json` (Win) with `{ "developer": true }`
- **Not available** through Adobe Admin Console for enterprise customers

## Bolt UXP (Recommended Boilerplate)

Open-source Vite-based boilerplate by Hyper Brew:

```bash
yarn create bolt-uxp     # Scaffold with React/Svelte/Vue + TypeScript
yarn dev                  # Hot reload development (WebSocket-based, faster than UDT)
yarn build                # Production build
yarn ccx                  # Package for distribution
yarn zip                  # Bundle CCX with sidecar assets
```

Features:
- TypeScript definitions for UXP and Premiere APIs
- WebSocket-based hot reload (faster than UDT file watcher)
- Multi-panel support via `uxp.config.ts`
- Theme-aware CSS variables (light, dark, lightest, darkest)
- GitHub Actions CI/CD for automated CCX releases
- Webview UI (beta) — full HTML/CSS/JS DOM via Edge/Safari
- Hybrid C++ plugin template support
- Supports: Photoshop, InDesign, Premiere Pro, Illustrator (beta)

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

Two manifest.json files: source (for UDT loading) and distribution (build output). Prefer loading from source manifest.

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

## Chrome DevTools Debugging

If using UDT CLI, connect via `chrome://inspect` with your debug port.

```bash
# Headless plugin management
npx @adobe-uxp/devtools-cli load /path/to/manifest.json
npx @adobe-uxp/devtools-cli debug <plugin-id>
```

## CCX Packaging

Distribution format is CCX (Creative Cloud Extension):
1. Build your plugin to output directory
2. Zip the output directory
3. Rename `.zip` to `.ccx`
4. No signature required (unlike old ZXP)
5. Upload to Adobe Developer Distribution portal for marketplace

Installed plugins appear under Window > UXP Plugins in Premiere.
