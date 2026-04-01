# UXP Plugin Creation — Complete Reference

## Prerequisites

- **Premiere Pro v25.6+** — UXP graduated from beta in this release
- **UXP Developer Tool (UDT) v2.2+** — install from Creative Cloud Desktop > Stock & Marketplace > Plugins > UXP Developer Tool
- **Developer Mode**: Premiere > Settings > Plugins > Enable Developer Mode > restart Premiere
- **Admin privileges** required to run UDT (macOS: run from Applications; Windows: Run as Administrator)

## Minimum Folder Structure

```
my-plugin/
├── manifest.json     # Required — plugin metadata + entrypoints
├── index.html        # UI entry point (panel markup)
└── index.js          # entrypoints.setup() call
```

Optional additions:

```
my-plugin/
├── manifest.json
├── index.html
├── index.js
├── styles.css
├── icons/
│   ├── dark.png          # 23x23 — toolbar icon, dark theme
│   ├── light.png         # 23x23 — toolbar icon, light theme
│   └── plugin-icon.png   # 48x48 — plugin list icon
└── src/                  # application code
```

## manifest.json Complete Reference

```jsonc
{
  // --- REQUIRED ---
  "manifestVersion": 5,                    // Always 5 for current UXP
  "id": "com.company.pluginname",          // Reverse-domain unique ID
  "name": "My Plugin",                     // Display name (or LocalizedString)
  "version": "1.0.0",                      // SemVer
  "host": {                                // Single object for production
    "app": "premierepro",
    "minVersion": "25.6.0"
  },
  "entrypoints": [
    {
      "type": "panel",                     // "panel" or "command"
      "id": "mainPanel",                   // Must match key in entrypoints.setup()
      "label": "My Panel",                // Display name (or LocalizedString)
      "minimumSize": { "width": 230, "height": 200 },
      "maximumSize": { "width": 2000, "height": 2000 },
      "preferredDockedSize": { "width": 300, "height": 400 },
      "preferredFloatingSize": { "width": 400, "height": 500 },
      "icons": [
        // species: "generic" (default), "toolbar", "pluginList"
        // theme: "darkest", "dark", "medium", "light", "lightest", "all"
        // scale: [1, 2]
        { "width": 23, "height": 23, "path": "icons/dark.png",
          "species": "toolbar", "theme": ["darkest", "dark"], "scale": [1, 2] },
        { "width": 23, "height": 23, "path": "icons/light.png",
          "species": "toolbar", "theme": ["light", "lightest"], "scale": [1, 2] },
        { "width": 48, "height": 48, "path": "icons/plugin-icon.png",
          "species": "pluginList", "theme": ["all"], "scale": [1, 2] }
      ]
    },
    {
      "type": "command",
      "id": "myCommand",
      "label": "Run My Command"
    }
  ],

  // --- OPTIONAL ---
  "main": "index.js",                     // Default: "main.js"
  "icons": [                              // Plugin-level icons (fallback)
    { "width": 48, "height": 48, "path": "icons/plugin-icon.png",
      "species": "pluginList", "theme": ["all"], "scale": [1, 2] }
  ],
  "strings": {                            // i18n string overrides
    "locales": ["en", "fr"],
    "default": "en",
    "paths": { "en": "strings/en.json", "fr": "strings/fr.json" }
  },
  "requiredPermissions": {
    "localFileSystem": "fullAccess",       // "request" | "fullAccess" | "plugin"
    "clipboard": "readAndWrite",           // "read" | "readAndWrite"
    "network": {
      "domains": ["https://api.example.com", "wss://ws.example.com"]
    },
    "launchProcess": {                     // Launch external processes
      "schemes": ["https"],
      "extensions": []
    },
    "ipc": {                               // Inter-plugin communication
      "enablePluginCommunication": true
    },
    "allowCodeGenerationFromStrings": true, // eval() / new Function() — needed for some bundlers
    "enableUserInfo": true                  // Access Adobe user profile
  },
  "featureFlags": {
    "enableSWCSupport": true               // Enable SWC module support
  }
}
```

### LocalizedString Format

Anywhere a string is expected (name, label), you can use:

```json
{ "default": "My Plugin", "fr": "Mon Plugin", "de": "Mein Plugin" }
```

### IMPORTANT Notes

- `host` must be a **single object** for production builds. Array format (`[{app: "premierepro"}, {app: "aftereffects"}]`) is only for multi-host dev testing.
- `id` in each entrypoint must be unique within the plugin and must exactly match the key used in `entrypoints.setup()`.
- `manifestVersion` 5 means `rootNode` in panel hooks points to `<body>`, not a custom container.

## entrypoints.setup() Complete Reference

```javascript
const { entrypoints } = require("uxp");

entrypoints.setup({
  plugin: {
    create() {
      // Plugin-level init — runs once when plugin loads
      // Good for: initializing shared state, setting up connections
    },
    destroy() {
      // Plugin-level teardown — runs when plugin unloads
      // Good for: cleanup, disconnecting sockets
    }
  },

  panels: {
    mainPanel: {
      create(rootNode) {
        // First-time panel initialization
        // rootNode is <body> element (manifest v5)
      },
      show(rootNode) {
        // Panel becomes visible
        // Runs ONCE — panels are persistent, not re-created
        // Use this as your main setup hook
        rootNode.appendChild(myUI);
      },
      hide(rootNode) {
        // BROKEN in Premiere — never fires reliably
        // Do NOT rely on this for cleanup
      },
      destroy(rootNode) {
        // BROKEN in Premiere — never fires reliably
        // Do NOT rely on this for cleanup
      },
      menuItems: [
        { id: "reload", label: "Reload Data", enabled: true, checked: false }
      ],
      invokeMenu(id) {
        // Flyout menu handler
        if (id === "reload") { /* ... */ }
      }
    }
  },

  commands: {
    myCommand(evt) {
      // evt.type === "uxpcommand"
      // Triggered from Window > UXP Plugins > [Plugin Name] > [Command Name]
    }
  }
});
```

### Critical Rules

- `entrypoints.setup()` can only be called **ONCE** per plugin lifecycle
- All hooks can return Promises (300ms timeout before Premiere considers them failed)
- Panel keys MUST match manifest entrypoint IDs exactly (case-sensitive)
- Commands appear under Window > UXP Plugins > [Plugin Name] > [Command Name]

## Panel Lifecycle Table

| Hook | When | Parameter | Notes |
|---|---|---|---|
| `create` | First initialization | `<body>` element | Runs once on plugin load |
| `show` | Panel becomes visible | `<body>` element | Runs ONCE — panels are persistent, not re-created on show/hide |
| `hide` | Panel hidden | `<body>` element | **BROKEN** in Premiere — do not rely on |
| `destroy` | Plugin terminated | `<body>` element | **BROKEN** in Premiere — do not rely on |

**Workaround for hide/destroy**: Use `plugin.destroy()` for cleanup, or listen for `beforeunload` on `window`.

## Multi-Panel Setup

Each panel gets its own lifecycle handlers:

```javascript
entrypoints.setup({
  panels: {
    mainPanel: {
      show(rootNode) { rootNode.appendChild(buildMainUI()); }
    },
    settingsPanel: {
      show(rootNode) { rootNode.appendChild(buildSettingsUI()); }
    }
  }
});
```

- Each panel ID requires a matching entrypoint in `manifest.json`
- Open panels programmatically: `pluginManager.showPanel("panelId")`
- Cannot close panels programmatically — user must close manually
- Each panel shares the same JS context (same global scope, same modules)

## Loading with UDT

1. Open Premiere Pro (Developer Mode must be enabled)
2. Open UDT (requires admin privileges)
3. Click **Add Plugin** > browse to `manifest.json`
4. Click **Load** (one-time) or **Load & Watch** (auto-reload on file changes)
5. Panel appears under **Window > UXP Plugins**
6. Click **Debug** to open Chrome DevTools inspector

### UDT Tips

- **Watch mode**: auto-reloads on source file changes — great for development
- **Manifest changes** require manual unload/reload (watch mode won't pick them up)
- **UDT Playground**: sandbox environment for testing API calls interactively
- **Console**: UDT Debug console shows `console.log()` output and errors
- If plugin fails to load, check UDT console for manifest validation errors

## Scaffolding Options

### Option A: UDT Templates

UDT > Create Plugin > select `premierepro-quick-starter`

Generates minimal working plugin with manifest + panel. Good for learning, not for production.

### Option B: Bolt UXP (Hyper Brew)

```bash
npx create-bolt-uxp      # interactive scaffold
cd my-plugin
yarn dev                  # hot reload via WebSocket
yarn build                # production bundle
yarn ccx                  # package as .ccx
yarn zip                  # zip bundle for sharing
```

- Framework support: React, Svelte, Vue
- Vite-based build system with TypeScript support
- WebSocket hot reload (faster than UDT watch)
- Recommended for production plugins with complex UI

### Option C: Manual Setup

Create `manifest.json` + `index.html` + `index.js` by hand using the templates above. Best when you need full control or minimal dependencies.

### Option D: Adobe Samples

```bash
git clone https://github.com/AdobeDocs/uxp-premiere-pro-samples
```

Three samples:
- **premiere-api** — TypeScript, demonstrates core API usage
- **metadata-handler** — read/write clip metadata
- **oauth-workflow-sample** — Adobe OAuth integration

## CCX Packaging for Distribution

1. In UDT, click **...** menu on your plugin > **Package** > choose output folder
2. Generates `{plugin-id}_premierepro.ccx`
3. No digital signature required (unlike legacy `.zxp` format)
4. Install by double-clicking `.ccx` file or via UPIA CLI (`upia install plugin.ccx`)

### Distribution Channels

- **Adobe Marketplace**: submit via Adobe Developer Console portal, requires approval review
- **Independent**: share `.ccx` file directly (email, website, etc.)
- Use **separate plugin IDs** for Marketplace vs independent distribution to avoid conflicts

## TypeScript Setup

1. Get types from the official repo:
   ```bash
   # Clone or download types.d.ts
   curl -O https://raw.githubusercontent.com/AdobeDocs/uxp-premiere-pro/main/types.d.ts
   ```

2. Add reference at top of `.ts` files:
   ```typescript
   /// <reference path="./types.d.ts" />
   ```

3. `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "commonjs",
       "strict": true,
       "esModuleInterop": true,
       "outDir": "./dist",
       "rootDir": "./src"
     },
     "include": ["src/**/*", "types.d.ts"]
   }
   ```

4. Build with `tsc` then load the compiled JS via UDT. UXP does not run TypeScript natively.
