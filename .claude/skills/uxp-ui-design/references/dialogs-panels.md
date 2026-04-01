# UXP Panels, Dialogs & Theming

## Panel Types

### Panel (Dockable UI)
Persistent UI that docks into Premiere's workspace like native panels.

manifest.json entry with ALL sizing options:
```json
{
  "type": "panel",
  "id": "myPanel",
  "label": { "default": "My Panel" },
  "minimumSize": { "width": 230, "height": 200 },
  "maximumSize": { "width": 2000, "height": 2000 },
  "preferredDockedSize": { "width": 230, "height": 300 },
  "preferredFloatingSize": { "width": 400, "height": 500 },
  "icons": [
    { "path": "icons/dark.png", "width": 23, "height": 23, "themes": ["darkest", "dark", "medium"] },
    { "path": "icons/light.png", "width": 23, "height": 23, "themes": ["light", "lightest"] }
  ]
}
```

Lifecycle hooks:
- create(rootNode) — panel DOM created
- show(rootNode) — panel visible (runs ONCE, panels are persistent)
- hide(rootNode) — BROKEN in Premiere (tied to destroy, not independent)
- destroy(rootNode) — BROKEN in Premiere

Key facts:
- show() tied to create(), hide() tied to destroy()
- Panels are persistent — show() runs only once
- Can dock, float, resize like native Premiere panels
- No API to programmatically close panels

### Command (Menu Item)
Fire-and-forget menu action. No persistent UI. Can optionally show modal dialog.

manifest.json:
```json
{ "type": "command", "id": "myCmd", "label": { "default": "Run" } }
```

Appears under Window > UXP Plugins > [Plugin Name] > [Command Name]

## Modal Dialogs

### HTML Approach (in-document)
```html
<dialog id="myDialog">
  <sp-heading size="L">Title</sp-heading>
  <sp-divider size="large"></sp-divider>
  <sp-body>Content</sp-body>
  <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
    <sp-button variant="secondary" onclick="...close('cancel')">Cancel</sp-button>
    <sp-button variant="cta" onclick="...close('confirm')">Confirm</sp-button>
  </div>
</dialog>
```

### Opening
```javascript
const result = await dialog.uxpShowModal({
  title: "Confirm Action",
  resize: "both",  // "horizontal" | "vertical" | "both" | "none"
  size: { width: 400, height: 300 }
});
// result: "confirm", "cancel", or "reasonCanceled" (Esc/close button)
```

### Dynamic Creation (React/Preact pattern)
```javascript
const dlg = document.createElement("dialog");
render(<MyComponent dialog={dlg} />, dlg);
document.body.appendChild(dlg);
const result = await dlg.uxpShowModal({ title: "...", resize: "none", size: { width: 464, height: 380 } });
dlg.remove(); // MUST remove manually — not auto-removed
```

### Dialog Gotchas
- dialog.close(value) passes the return value
- ESC/close button passes "reasonCanceled"
- Dialog NOT auto-removed from DOM — remove it yourself for dynamic dialogs
- Undocumented sp-dialog component exists but is UNSTABLE — avoid
- Dialog height may be uncontrollable in some versions

## Multi-Panel Architecture

### Shared State Pattern
```javascript
let sharedState = null;
function ensureApp() {
  if (!sharedState) {
    sharedState = { bus: createBus(), transport: createTransport() };
  }
  return sharedState;
}

function createPanelController(PanelComponent) {
  return {
    create(rootNode) { ensureApp(); },
    show(rootNode) {
      const { bus, transport } = ensureApp();
      render(<PanelComponent bus={bus} />, rootNode);
    }
  };
}
```

### Opening Other Panels
```javascript
const { pluginManager } = require("uxp");
const me = [...pluginManager.plugins].find(p => p.id === "com.my.plugin");
me?.showPanel("secondPanel");
// Cannot close panels programmatically — users must close manually
```

### Cross-Panel Communication
- BroadcastChannel API for cross-panel event sync
- Shared closure state for same-process panels
- IPC for cross-plugin communication

## Theming

### Theme Classes Available
- .spectrum--darkest, .spectrum--dark, .spectrum--light, .spectrum--lightest
- .spectrum--medium, .spectrum--large (size scales)

### CSS Variables (Premiere — define your own)
Premiere does NOT reliably provide Spectrum CSS custom properties. Define your own:

```css
body {
  --bg-app: #1e1e1e;
  --bg-surface: #2a2a2a;
  --bg-hover: #333333;
  --bg-active: #1a3a5c;
  --text-primary: #e0e0e0;
  --text-secondary: #999999;
  --text-disabled: #666666;
  --border-default: #333333;
  --accent: #4dabf7;
  --positive: #4caf50;
  --negative: #ff4444;
  --warning: #ff9800;
}
```

IMPORTANT: Hardcode hex values. Spectrum CSS variables like var(--spectrum-global-color-*) do NOT resolve in UXP.

### Media Query Support
```css
@media (prefers-color-scheme: dark) { /* auto-applied */ }
```

### Built-in Widget Theme Adaptation
Spectrum UXP widgets automatically adapt to theme changes — their colors update without manual intervention.

## Context Menu
Panels can have context menus:
```javascript
panels: {
  myPanel: {
    menuItems: [
      { id: "reload", label: "Reload Plugin" },
      { id: "about", label: "About" }
    ],
    invokeMenu(id) {
      switch (id) {
        case "reload": window.location.reload(); break;
        case "about": console.log("v1.0"); break;
      }
    }
  }
}
```
