# CEP to UXP Migration Guide

## Migration Phases

### Phase 1: Audit
1. List every CEP/ExtendScript API your extension calls
2. Map each to the UXP equivalent (see table below)
3. Identify gaps — file feature requests with Adobe

### Phase 2: Architecture Changes

| CEP Pattern | UXP Equivalent |
|-------------|---------------|
| `CSInterface.evalScript()` | Direct `require("premierepro")` calls |
| `SystemPath.APPLICATION` | `require("uxp").host.name` |
| `CSEvent` | `EventManager.addGlobalEventListener()` |
| `CSInterface.getSystemPath()` | `fs.getPluginFolder()` / `fs.getDataFolder()` |
| Node.js `fs` | UXP `require("fs")` (subset) |
| `$.writeln()` | `console.log()` |
| `alert()` | `dialog.uxpShowModal()` |
| ZXP packaging | CCX packaging (zip + rename) |
| `window.cep.fs` | UXP `storage.localFileSystem` |

### Phase 3: API Property → Method Migration

The old CEP synchronous property access pattern is dead. In UXP:

| CEP/ExtendScript | UXP |
|-------------------|-----|
| `app.project` | `await ppro.Project.getActiveProject()` |
| `proj.activeSequence` | `await project.getActiveSequence()` |
| `seq.videoTracks.numTracks` | `sequence.getVideoTrackCount()` |
| `seq.videoTracks[i]` | `sequence.getVideoTrack(i)` |
| `track.clips[i]` | `track.getTrackItems(type, includeEmpty)[i]` |
| `clip.projectItem.getMediaPath()` | `ppro.ClipProjectItem.cast(clip.getProjectItem()).getMediaFilePath()` |
| `seq.markers.createMarker(time)` | `markers.createAddMarkerAction(...)` inside transaction |
| Direct property mutation | `create*Action()` + `compoundAction.addAction()` + `executeTransaction()` |

### Phase 4: Test Strategy

- Run both CEP and UXP versions side by side during migration
- Focus on: imports, timeline operations, exports, metadata, marker operations
- Test on minimum supported Premiere version (25.6)
- UXP currently only runs in Premiere Pro stable 25.6+ (graduated from beta Dec 2025)

## Key Architecture Differences

| Aspect | CEP | UXP |
|--------|-----|-----|
| Engine | Chromium + ExtendScript (dual) | Single V8 |
| Communication | Message passing between engines | Direct API access |
| DOM | Full browser DOM | Restricted subset (no canvas, no float, no createEvent) |
| Layout | Any CSS | Flexbox required, CSS Grid available |
| Packaging | ZXP (signed) | CCX (zip + rename, no signature) |
| Mutations | Direct property assignment | Action-based transaction pattern |
| Debugging | Chrome DevTools via CEF | UXP Developer Tool (UDT) |

## Timeline

Adobe assures "several years" post-launch for migration. CEP panels labeled "Extensions Legacy" in menus. No firm deprecation date yet. For new plugins, use UXP. For existing plugins, begin migration work but only complete if UXP supports all required features.
