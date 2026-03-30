# UXP Core APIs Reference

APIs shared across all UXP hosts (Premiere, Photoshop, InDesign). Available globally or via `require()`.

## File System

### LocalFileSystem (Object-Oriented)

```javascript
const { storage } = require("uxp");
const fs = storage.localFileSystem;

// Plugin folders (no permission needed)
const pluginFolder = await fs.getPluginFolder();
const dataFolder = await fs.getDataFolder();    // persistent across sessions
const tempFolder = await fs.getTemporaryFolder();

// Read a file
const file = await pluginFolder.getEntry("config.json");
const content = await file.read();               // UTF-8 string by default
const json = JSON.parse(content);

// Write a file
const outFile = await dataFolder.createFile("output.json", { overwrite: true });
await outFile.write(JSON.stringify(data, null, 2));

// User file picker (requires "localFileSystem": "request" or "fullAccess")
const pickedFile = await fs.getFileForOpening({ types: ["mp4", "mov"] });
if (pickedFile) {
  const path = pickedFile.nativePath;
  const token = await fs.createPersistentToken(pickedFile);
  localStorage.setItem("lastFile", token);
}

// Retrieve from persistent token (may be invalid — handle errors)
const token = localStorage.getItem("lastFile");
if (token) {
  try {
    const entry = await fs.getEntryForPersistentToken(token);
  } catch (e) {
    localStorage.removeItem("lastFile"); // file moved/deleted
  }
}
```

### fs Module (Path-Based, Node.js-Like)

```javascript
const fs = require("fs");

const data = await fs.readFile("/absolute/path/to/file.txt", { encoding: "utf-8" });
await fs.writeFile("/absolute/path/to/output.txt", "content here");
const exists = await fs.lstat("/path").then(() => true).catch(() => false);
```

Requires `"localFileSystem": "fullAccess"` in manifest for arbitrary paths.

## Network

### Fetch API (Global)

```javascript
const response = await fetch("https://api.example.com/data", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ key: "value" })
});
const data = await response.json();
```

Domain MUST be whitelisted in manifest: `"network": { "domains": ["https://api.example.com"] }`

### WebSocket (Global)

```javascript
const ws = new WebSocket("ws://localhost:8000");

ws.onopen = () => ws.send(JSON.stringify({ type: "hello" }));
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.onerror = (err) => console.error("WebSocket error:", err);
ws.onclose = () => console.log("Disconnected");
```

`ws://` and `wss://` domains must be whitelisted separately in manifest.

### XMLHttpRequest (Global)

Available for legacy compatibility. Standard browser API.

## Storage & Persistence

### localStorage (Key-Value, Persistent)

```javascript
localStorage.setItem("preference", JSON.stringify({ theme: "dark" }));
const pref = JSON.parse(localStorage.getItem("preference"));
localStorage.removeItem("preference");
```

Can be cleared by user/system — don't store irreplaceable data. Not for secrets.

### sessionStorage (Session Only)

```javascript
sessionStorage.setItem("tempState", "value"); // load → unload lifecycle
```

### Secure Storage (For Secrets)

```javascript
const secureStorage = require("uxp").storage.secureStorage;
await secureStorage.setItem("apiKey", "secret-value");
const key = await secureStorage.getItem("apiKey");
```

## Clipboard

Requires manifest: `"clipboard": "readAndWrite"` (or `"read"` for read-only).

```javascript
const clipboard = navigator.clipboard;
await clipboard.setContent({ "text/plain": "Hello from plugin" });
const content = await clipboard.getContent();
const text = content["text/plain"];
```

## Modal Dialogs

```javascript
const dialog = document.createElement("dialog");
dialog.innerHTML = `
  <sp-heading>Confirm Action</sp-heading>
  <sp-body>Are you sure?</sp-body>
  <footer>
    <sp-button variant="secondary" id="cancelBtn">Cancel</sp-button>
    <sp-button variant="cta" id="okBtn">OK</sp-button>
  </footer>
`;
document.body.appendChild(dialog);

dialog.querySelector("#okBtn").addEventListener("click", () => dialog.close("ok"));
dialog.querySelector("#cancelBtn").addEventListener("click", () => dialog.close("cancel"));

const result = await dialog.uxpShowModal({
  title: "Confirm",
  resize: "none",          // "none", "both", "horizontal", "vertical"
  size: { width: 300, height: 200 }
});
// result: "ok", "cancel", or "reasonCanceled" (Esc/close button)
dialog.remove();
```

Use a Singleton pattern for dialogs to prevent duplicate DOM elements on reload.

## Inter-Plugin Communication

Requires manifest: `"ipc": { "enablePluginCommunication": true }`

```javascript
const { pluginManager } = require("uxp");
const allPlugins = pluginManager.plugins;
const target = Array.from(allPlugins).find(p => p.id === "com.other.plugin");

if (target && target.enabled) {
  target.invokeCommand("commandId");
  target.invokeCommand("commandId", { key: "value" }); // with payload
  target.showPanel("panelId");
}
// No error thrown if entrypoint not found — validate via plugin.manifest.commands
```

## Host Environment

```javascript
const uxp = require("uxp");
uxp.version          // UXP runtime version
uxp.host.name        // "premierepro"
uxp.host.version     // "25.6.0"

const os = require("os");
os.platform()        // "darwin", "win32"
```
