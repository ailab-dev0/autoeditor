# UXP Core APIs Reference

APIs shared across all UXP hosts (Premiere, Photoshop, InDesign). Available globally or via `require()`.

## File System

### Manifest Permissions

Three levels control file system access:

```json
{
  "requiredPermissions": {
    "localFileSystem": "plugin"      // default — sandbox only
    // "localFileSystem": "request"  // picker dialogs for user-chosen files
    // "localFileSystem": "fullAccess" // unrestricted path-based access
  }
}
```

- **`plugin`** — read/write only within `getPluginFolder()`, `getDataFolder()`, `getTemporaryFolder()`
- **`request`** — adds file/folder picker dialogs; user must explicitly grant access
- **`fullAccess`** — unrestricted reads/writes to any path via `require("fs")` or entries

### LocalFileSystem (Object-Oriented)

```javascript
const { storage } = require("uxp");
const fs = storage.localFileSystem;

// Built-in sandboxed locations (no permission needed)
const pluginFolder = await fs.getPluginFolder();   // read-only plugin bundle
const dataFolder = await fs.getDataFolder();        // persistent across sessions
const tempFolder = await fs.getTemporaryFolder();   // cleared on restart
```

### Entry API (Files and Folders)

Every file/folder from the local file system is an `Entry` object:

```javascript
const entry = await dataFolder.getEntry("config.json");

// Properties
entry.name;        // "config.json"
entry.nativePath;  // "/Users/me/Library/.../config.json"
entry.url;         // "file:///Users/me/Library/.../config.json"
entry.isFile;      // true
entry.isFolder;    // false

// Metadata
const meta = await entry.getMetadata();
meta.size;          // bytes
meta.dateCreated;   // Date
meta.dateModified;  // Date

// Operations
await entry.copyTo(targetFolder, { overwrite: true });
await entry.moveTo(targetFolder, { overwrite: true });
await entry.delete();
```

### Folder Operations

```javascript
const folder = await fs.getDataFolder();

// List all entries
const entries = await folder.getEntries();
entries.forEach(e => console.log(e.name, e.isFile ? "file" : "folder"));

// Get specific entry (throws if not found)
const file = await folder.getEntry("settings.json");

// Create subfolder
const sub = await folder.createFolder("exports");

// Create file
const newFile = await folder.createFile("output.json", { overwrite: true });

// Rename
await folder.renameEntry(file, "settings-backup.json", { overwrite: true });
```

### Reading and Writing

```javascript
// Text read/write
const file = await dataFolder.getEntry("config.json");
const content = await file.read();                          // UTF-8 string
await file.write(JSON.stringify(data, null, 2));

// Binary read/write — use storage.formats.binary
const binFile = await dataFolder.getEntry("image.png");
const buffer = await binFile.read({ format: storage.formats.binary }); // ArrayBuffer

const outFile = await dataFolder.createFile("copy.png", { overwrite: true });
await outFile.write(buffer, { format: storage.formats.binary });
```

### File Pickers and Persistent Tokens

```javascript
// User file picker (requires "localFileSystem": "request" or "fullAccess")
const pickedFile = await fs.getFileForOpening({ types: ["mp4", "mov"] });
if (pickedFile) {
  const path = pickedFile.nativePath;

  // Persistent token — survives plugin restart, stored in localStorage
  const token = await fs.createPersistentToken(pickedFile);
  localStorage.setItem("lastFile", token);

  // Session token — valid only for current plugin session
  const sessionToken = await fs.createSessionToken(pickedFile);
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

// Session token retrieval
const entry = await fs.getEntryForSessionToken(sessionToken);
```

### File System Error Types

```javascript
const { storage } = require("uxp");

try {
  await folder.createFile("existing.json");
} catch (e) {
  // e is one of:
  // storage.errors.EntryExistsError    — file/folder already exists
  // storage.errors.PermissionDeniedError — insufficient manifest permission
  // storage.errors.OutOfSpaceError     — disk full
  // storage.errors.FileIsReadOnlyError — read-only entry (e.g., pluginFolder)
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

## Network — fetch()

### Signature

```javascript
const response = await fetch(input, init);
// input: string URL or Request object
// init: { method, headers, body, credentials }
// Returns: Promise<Response>
```

### Supported init Options

```javascript
const response = await fetch("https://api.example.com/data", {
  method: "POST",                                // GET, POST, PUT, DELETE, PATCH
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ key: "value" }),         // string | ArrayBuffer | TypedArray | FormData
  credentials: "include"                          // "include" | "omit" | "same-origin"
});
// body does NOT support Blob
// There is NO "mode" option (no "no-cors")
```

### CRITICAL: Host Resolution Rules

```javascript
// HTTPS required for all remote hosts
await fetch("https://api.example.com/data");  // OK
await fetch("http://api.example.com/data");   // FAILS — ATS blocks HTTP

// Local development: use 127.0.0.1, NOT localhost
await fetch("http://127.0.0.1:3000/api");    // OK
await fetch("http://localhost:3000/api");     // FAILS on macOS (ATS enforcement)
```

### Response Handling Gotchas

```javascript
const response = await fetch(url);

// CRITICAL: fetch() NEVER rejects on HTTP errors (404, 500, etc.)
// It only rejects on network failures (DNS, timeout, connection refused)
if (!response.ok) {
  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
}

// CRITICAL: response.blob() is unreliable — returns empty/corrupt data
// Use arrayBuffer() then construct Blob manually
const buffer = await response.arrayBuffer();
const blob = new Blob([buffer], { type: response.headers.get("content-type") });

// Standard response methods that work
const json = await response.json();
const text = await response.text();
const arrayBuf = await response.arrayBuffer();
```

### FormData Upload Bug

```javascript
// FormData file uploads are buggy — always instantiate FormData INSIDE the upload function
async function uploadFile(url, fileBuffer, filename) {
  // DO THIS: create FormData right before fetch
  const formData = new FormData();
  formData.append("file", new Blob([fileBuffer]), filename);

  // DO NOT reuse FormData across calls — payload may be empty
  const response = await fetch(url, { method: "POST", body: formData });
  return response;
}
```

### OS-Level Caching

```javascript
// macOS NSURLSession caches aggressively — bust with hash fragment
const url = `https://api.example.com/data?ts=${Date.now()}#${Math.random()}`;
const response = await fetch(url);

// NOTE: fetch bypasses system proxy settings on macOS
// VPN/proxy users won't have traffic routed through their proxy
```

## Network — WebSocket

### Basic Usage

```javascript
const ws = new WebSocket("ws://localhost:8000");

ws.onopen = () => ws.send(JSON.stringify({ type: "hello" }));
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.onclose = (e) => console.log("Closed:", e.code, e.reason);
```

### CRITICAL: Host Resolution (Opposite of fetch!)

```javascript
// WebSocket: use localhost, NOT 127.0.0.1
const ws = new WebSocket("ws://localhost:8000");     // OK
const ws = new WebSocket("ws://127.0.0.1:8000");    // FAILS silently

// In manifest domain whitelist, use localhost too (see Network Permissions)
```

### Empty Error Objects

```javascript
ws.onerror = (err) => {
  // CRITICAL: err is {} — no message, no code, no stack
  // You get zero diagnostic information from WebSocket errors
  console.error("WebSocket error — no details available:", err);
  // Workaround: check ws.readyState and infer from context
};
```

### Silent Failure Mode

Manifest v5 requires explicit domain whitelisting for WebSocket. Without it, connections fail **SILENTLY** — no error, no event, nothing. The WebSocket just never connects.

Both `ws://` and `wss://` need separate entries in the manifest.

## Network — XMLHttpRequest

### Full XHR API

```javascript
const xhr = new XMLHttpRequest();
xhr.open("POST", "https://api.example.com/upload");

// responseType options: "arraybuffer" | "blob" | "document" | "json" | "text"
xhr.responseType = "arraybuffer";

// Upload progress tracking
xhr.upload.onprogress = (e) => {
  if (e.lengthComputable) {
    const pct = Math.round((e.loaded / e.total) * 100);
    console.log(`Upload: ${pct}%`);
  }
};

xhr.onload = () => {
  if (xhr.status >= 200 && xhr.status < 300) {
    const buffer = xhr.response; // ArrayBuffer
  }
};

xhr.onerror = () => console.error("XHR failed");
xhr.send(body);
```

### XHR-Specific Behaviors

```javascript
// withCredentials defaults to TRUE (opposite of browser default)
xhr.withCredentials = true; // already the default in UXP

// Self-signed certs are NOT supported — causes opaque network error

// responseURL property is NOT supported — do not rely on it
// xhr.responseURL; // undefined
```

## Network Permissions (Manifest)

### CRITICAL: Structure and Placement

```json
{
  "id": "com.example.plugin",
  "name": "My Plugin",
  "requiredPermissions": {
    "network": {
      "domains": [
        "https://api.example.com",
        "wss://ws.example.com",
        "ws://localhost"
      ]
    }
  }
}
```

**requiredPermissions MUST be at manifest root level, NOT nested inside `host`:**

```json
// WRONG — permissions silently ignored
{
  "host": {
    "app": "premierepro",
    "requiredPermissions": { "network": { "domains": "all" } }
  }
}

// CORRECT — permissions at root
{
  "requiredPermissions": { "network": { "domains": "all" } },
  "host": { "app": "premierepro" }
}
```

### Domain Declaration Rules

```json
// "all" as STRING works — allows all domains
"domains": "all"

// "all" as ARRAY is BROKEN — silently denies all network access
"domains": ["all"]   // BUG — does NOT work

// IP addresses NOT allowed in domains
"domains": ["https://192.168.1.100"]  // FAILS

// Wildcards in TLDs NOT supported from UXP v7.4.0+
"domains": ["https://*.com"]  // FAILS in v7.4+

// Each protocol needs its own entry
"domains": [
  "https://api.example.com",   // for fetch()
  "ws://localhost",             // for WebSocket ws://
  "wss://ws.example.com"       // for WebSocket wss://
]
```

## CORS Behavior

UXP is **not a browser** — CORS works differently:

- No `"no-cors"` mode option exists
- UXP generally does not enforce CORS preflight like browsers
- Self-signed HTTPS certs cause opaque `"Network error"` with zero detail
- **Workaround for self-signed certs**: Run a Node.js proxy on `127.0.0.1` and fetch from there

```javascript
// If you get "Network error" with no useful message:
// 1. Check manifest permissions (most common cause)
// 2. Check if target uses self-signed cert
// 3. Check if using HTTP instead of HTTPS for remote host
// 4. Try XMLHttpRequest for better error info
```

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

### secureStorage (Async, For Secrets)

```javascript
const secureStorage = require("uxp").storage.secureStorage;

// CRITICAL: secureStorage is ASYNC — returns Promises (unlike localStorage)
await secureStorage.setItem("apiKey", "secret-value");
const key = await secureStorage.getItem("apiKey");
await secureStorage.removeItem("apiKey");

// CRITICAL: Treat secureStorage as a CACHE, not persistent storage
// Data can be lost when:
//   - OS keychain is reset
//   - User clears credentials
//   - Plugin is reinstalled
// Always handle missing data gracefully

async function getToken() {
  const token = await secureStorage.getItem("authToken");
  if (!token) {
    // Token disappeared — redirect to login
    return null;
  }
  return token;
}
```

Good for: auth tokens, API keys, refresh tokens.
Bad for: sole source of truth for any data.

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

## Inter-Plugin Communication (IPC)

Requires manifest: `"ipc": { "enablePluginCommunication": true }`

**Requirements**: Premiere Pro v25.2+, UDT v2.1.0+, Manifest v5+

```javascript
const { pluginManager } = require("uxp");
const allPlugins = pluginManager.plugins;
const target = Array.from(allPlugins).find(p => p.id === "com.other.plugin");

if (target && target.enabled) {
  target.invokeCommand("commandId");
  target.invokeCommand("commandId", { key: "value" }); // with payload
  target.showPanel("panelId"); // can only SHOW panels, cannot HIDE them
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

## Silent Failure Modes

The most dangerous UXP bugs produce **zero error output**. Reference table:

| Issue | Symptom | Fix |
|---|---|---|
| `requiredPermissions` nested inside `host` | All network calls silently fail | Move `requiredPermissions` to manifest root level |
| `"domains": ["all"]` (array) | Network access silently denied | Use `"domains": "all"` (string, no array) |
| `localhost` in fetch URL | macOS ATS blocks HTTP, request fails | Use `127.0.0.1` for fetch |
| `127.0.0.1` in WS manifest domain | WebSocket silently never connects | Use `localhost` in manifest and WS URL |
| Missing `ws://` in manifest domains | WebSocket silently never connects | Add explicit `ws://` and/or `wss://` entries |
| Self-signed HTTPS cert | `"Network error"` with no detail | Use Node.js local proxy on `127.0.0.1` |
| `response.blob()` | Returns empty or corrupt Blob | Use `response.arrayBuffer()` then `new Blob([buffer])` |
| FormData reuse across calls | Upload payload is empty | Instantiate new `FormData` inside each upload call |
| HTTP 404/500 error status | fetch Promise resolves (not rejects) | Always check `response.ok` before reading body |
| WebSocket `onerror` event | Receives empty `{}` object | Infer error from `readyState` and connection context |
| fetch behind VPN/proxy | Traffic bypasses system proxy | Use explicit proxy or local relay server |
| Manifest not reloaded after edit | Old permissions cached by host | Fully quit and relaunch host app (not just reload plugin) |
| secureStorage data loss | Auth token silently disappears | Treat as cache; handle missing data with re-auth flow |
