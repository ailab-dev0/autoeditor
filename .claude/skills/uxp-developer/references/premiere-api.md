# Premiere Pro UXP API Reference

Complete API reference for the `premierepro` host module (v25.0+).

```javascript
const ppro = require("premierepro");
```

## Project

```javascript
// Static methods
const project = await ppro.Project.getActiveProject();
const newProject = await ppro.Project.createProject("/path/to/project.prproj");
const isValid = ppro.Project.isProject("/path/to/file.prproj");

// Properties (read-only)
project.guid   // Guid
project.name   // string
project.path   // string (absolute path)

// Sequence management
const activeSeq = await project.getActiveSequence();      // Sequence
const allSeqs = await project.getSequences();              // Sequence[]
const seq = await project.getSequence(guid);               // Sequence
await project.setActiveSequence(seq);                      // boolean
const newSeq = await project.createSequence("name", presetPath); // Sequence
await project.deleteSequence(seq);                         // boolean
await project.openSequence(seq);                           // boolean
await project.closeSequence(seq);                          // boolean

// Project structure
const rootItem = await project.getRootItem();              // FolderItem
const insertBin = await project.getInsertionBin();         // ProjectItem

// Import
await project.importFiles(
  ["/path/to/file.mp4"],
  true,       // suppressUI
  targetBin,  // ProjectItem (target bin)
  false       // asNumberedStills
);

// Transaction (atomic, undo-able)
await project.executeTransaction(async (compoundAction) => {
  // ... add actions via compoundAction.addAction(action) ...
}, "Undo Label");

// Locked access (prevents state changes during callback)
await project.lockedAccess(() => {
  // read-only operations here — project state frozen
});

// CRITICAL: lockedAccess callback is SYNCHRONOUS (not async)
// getTrackItems() and getMarkers() are also synchronous
await project.lockedAccess(() => {
  // synchronous reads only — no await inside
  const seq = project.getActiveSequence(); // ERROR: can't await
});

// Lifecycle
await project.save();
await project.saveAs("/new/path.prproj");
await project.close(closeOptions);
```

## Sequence

```javascript
const sequence = await project.getActiveSequence();

// Properties (read-only)
sequence.guid   // Guid
sequence.name   // string

// Time queries
sequence.getPlayerPosition()   // TickTime
sequence.getInPoint()          // TickTime
sequence.getOutPoint()         // TickTime
sequence.getZeroPoint()        // TickTime
sequence.getEndTime()          // TickTime

// Track access
sequence.getVideoTrackCount()                // number
sequence.getVideoTrack(0)                    // VideoTrack
sequence.getAudioTrackCount()                // number
sequence.getAudioTrack(0)                    // AudioTrack
sequence.getCaptionTrackCount()              // number
sequence.getCaptionTrack(0)                  // CaptionTrack

// Settings
sequence.getSettings()                       // SequenceSettings
sequence.getTimebase()                       // string
sequence.getFrameSize()                      // RectF
sequence.getSequenceVideoTimeDisplayFormat() // TimeDisplay

// Selection
sequence.getSelection()                      // TrackItemSelection
sequence.setSelection(selection)             // boolean
sequence.clearSelection()                    // boolean

// Player control
sequence.setPlayerPosition(tickTime)         // boolean

// Action creators (require transaction)
sequence.createSetInPointAction(tickTime)     // Action
sequence.createSetOutPointAction(tickTime)    // Action
sequence.createSetZeroPointAction(tickTime)   // Action
sequence.createSetSettingsAction(settings)    // Action
sequence.createCloneAction()                  // Action

// Sub-sequences & associated items
sequence.createSubsequence(ignoreTrackTargeting) // Sequence
sequence.getProjectItem()                        // ProjectItem
```

## VideoTrack / AudioTrack

```javascript
const track = sequence.getVideoTrack(0);

// Properties (read-only)
track.name  // string
track.id    // number

// Methods
track.getIndex()          // number
track.getMediaType()      // Guid
track.isMuted()           // boolean
track.setMute(true)       // boolean

// Get track items — THE KEY METHOD
track.getTrackItems(
  ppro.Constants.TrackItemType.CLIP,  // filter: CLIP=1, TRANSITION=2, etc.
  false                                // includeEmptyTrackItems
)  // Returns VideoClipTrackItem[] or AudioClipTrackItem[]
```

**TrackItemType Constants:**
- `Constants.TrackItemType.EMPTY` = 0
- `Constants.TrackItemType.CLIP` = 1
- `Constants.TrackItemType.TRANSITION` = 2
- `Constants.TrackItemType.PREVIEW` = 3
- `Constants.TrackItemType.FEEDBACK` = 4

**Track Events:** `EVENT_TRACK_CHANGED`, `EVENT_TRACK_INFO_CHANGED`, `EVENT_TRACK_LOCK_CHANGED`

## VideoClipTrackItem / AudioClipTrackItem

```javascript
const clips = track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
const clip = clips[0]; // VideoClipTrackItem

// Getters (no transaction needed)
clip.getStartTime()       // TickTime — position on timeline
clip.getEndTime()         // TickTime
clip.getDuration()        // TickTime
clip.getInPoint()         // TickTime — in-point relative to source media
clip.getOutPoint()        // TickTime — out-point relative to source media
clip.getName()            // string
clip.getMatchName()       // string
clip.getSpeed()           // number (1.0 = normal)
clip.getTrackIndex()      // number
clip.getType()            // number
clip.getMediaType()       // Guid
clip.getIsSelected()      // boolean
clip.isDisabled()         // boolean
clip.isAdjustmentLayer()  // boolean
clip.isSpeedReversed()    // boolean/number

// Get associated project item (for media path)
clip.getProjectItem()     // ProjectItem

// Get effects chain
clip.getComponentChain()  // VideoComponentChain / AudioComponentChain

// Action creators (require transaction)
clip.createMoveAction(tickTime)              // Action — move in-point
clip.createSetStartAction(tickTime)          // Action — set start time
clip.createSetEndAction(tickTime)            // Action — set end time
clip.createSetInPointAction(tickTime)        // Action — set source in-point
clip.createSetOutPointAction(tickTime)       // Action — set source out-point
clip.createSetDisabledAction(boolean)        // Action — enable/disable
clip.createSetNameAction("name")             // Action — rename

// Video-only: transitions
clip.createAddVideoTransitionAction(transition, options)    // Action
clip.createRemoveVideoTransitionAction(transitionPosition)  // Action
```

## ClipProjectItem

```javascript
const projectItem = clip.getProjectItem();
const clipItem = ppro.ClipProjectItem.cast(projectItem); // MUST cast

// Properties (read-only)
clipItem.type   // number
clipItem.name   // string

// Media path — THE KEY METHOD for getting file paths
clipItem.getMediaFilePath()      // string — absolute path to source media
clipItem.canChangeMediaPath()    // boolean
clipItem.changeMediaFilePath(newPath) // boolean — relink media

// Media object
clipItem.getMedia()              // Media { start: TickTime, duration: TickTime }

// In/Out points
clipItem.getInPoint(mediaType)   // TickTime
clipItem.getOutPoint(mediaType)  // TickTime

// Proxy
clipItem.canProxy()              // boolean
clipItem.hasProxy()              // boolean
clipItem.attachProxy(path, ...)  // boolean
clipItem.getProxyPath()          // string

// Status
clipItem.isOffline()             // boolean
clipItem.isMergedClip()          // boolean
clipItem.isMulticamClip()        // boolean
clipItem.isSequence()            // boolean

// Footage interpretation
clipItem.getFootageInterpretation()  // FootageInterpretation

// Search
clipItem.findItemsMatchingMediaPath(path, ignoreSubclips)  // ProjectItem[]

// Action creators
clipItem.createSetNameAction("name")
clipItem.createSetColorLabelAction(colorIndex)
clipItem.createSetFootageInterpretationAction(interpretation)
clipItem.createSetOverrideFrameRateAction(fps)
clipItem.createSetOverridePixelAspectRatioAction(num, den)
clipItem.createSetScaleToFrameSizeAction()
clipItem.createSetInputLUTIDAction(lutGuid)
clipItem.createSetOfflineAction()
clipItem.setInPointAction(tickTime)
clipItem.setOutPointAction(tickTime)
clipItem.setInOutPointsAction(inTime, outTime)
clipItem.createClearInOutPointsAction()
```

## FolderItem (Bins)

```javascript
const rootItem = await project.getRootItem();
const folderItem = ppro.FolderItem.cast(rootItem);

const children = folderItem.getItems();  // ProjectItem[]

// Action creators (require transaction)
folderItem.createBinAction("Bin Name", true)       // create sub-bin
folderItem.createSmartBinAction("name", "query")   // smart bin
folderItem.createMoveItemAction(item, newParent)    // move item
folderItem.createRemoveItemAction(item)             // delete item
folderItem.createRenameBinAction("New Name")        // rename
```

## TickTime

Premiere uses tick-based time internally. `TickTime` is the universal time type.

```javascript
// Creation
const t1 = ppro.TickTime.createWithSeconds(10.5);
const t2 = ppro.TickTime.createWithTicks("2540160000000");  // string!
const t3 = ppro.TickTime.createWithFrameAndFrameRate(150, frameRate);

// Properties (read-only)
t1.seconds     // number — 10.5
t1.ticks       // string — tick value as string
t1.ticksNumber // number — tick value as number

// Arithmetic (returns NEW TickTime — immutable)
const sum = t1.add(t2);
const diff = t1.subtract(t2);
const scaled = t1.multiply(2.0);
const half = t1.divide(2);  // TIME_INVALID on divide-by-zero

// Frame alignment
const aligned = t1.alignToFrame(frameRate);         // lower frame boundary
const nearest = t1.alignToNearestFrame(frameRate);   // nearest frame

// Comparison
t1.equals(t2)  // boolean
```

**CRITICAL**: TickTime is immutable. All arithmetic returns new instances.

## Markers

```javascript
// Get markers for a sequence or clip
const markers = ppro.Markers.getMarkers(sequence);
// OR: ppro.Markers.getMarkers(clipProjectItem);

// Read markers
const allMarkers = markers.getMarkers();            // Marker[]
const filtered = markers.getMarkers(["Comment"]);   // filtered by type

// Marker properties
marker.getName()        // string
marker.getType()        // string ("Comment", "Chapter", etc.)
marker.getStart()       // TickTime
marker.getDuration()    // TickTime
marker.getComments()    // string
marker.getColor()       // Color
marker.getColorIndex()  // number
marker.getUrl()         // string
marker.getTarget()      // string

// Marker action creators (require transaction)
markers.createAddMarkerAction("Name", "Comment", startTime, duration, "comments")
markers.createMoveMarkerAction(marker, newTickTime)
markers.createRemoveMarkerAction(marker)

marker.createSetNameAction("New Name")
marker.createSetCommentsAction("New comment")
marker.createSetDurationAction(tickTime)
marker.createSetColorByIndexAction(3)
marker.createSetTypeAction("Chapter")
```

## SequenceEditor (Timeline Editing)

```javascript
const editor = ppro.SequenceEditor.getEditor(sequence);

// Insert clip onto timeline (creates tracks if needed)
editor.createInsertProjectItemAction(clipProjectItem, tickTime, videoTrackIdx, audioTrackIdx)
editor.createOverwriteItemAction(clipProjectItem, tickTime, videoTrack, audioTrack)
editor.createCloneTrackItemAction(trackItemSelection, tickTime, insertMode)
editor.createRemoveItemsAction(trackItemSelection, ripple, shift)

// Motion graphics templates
editor.insertMogrtFromPath(path, tickTime, videoTrack, audioTrack)
editor.insertMogrtFromLibrary(libraryItem, tickTime, videoTrack, audioTrack)
ppro.SequenceEditor.getInstalledMogrtPath()  // string

// NOTE: insertMogrtFromPath is NOT action-based — it executes immediately
// This is the exception to the action pattern
```

## TransitionFactory

```javascript
const matchNames = await ppro.TransitionFactory.getVideoTransitionMatchNames(); // string[]
const transition = ppro.TransitionFactory.createVideoTransition(matchName);
// Apply inside transaction: clip.createAddVideoTransitionAction(transition, options)
```

## Effects & Component Chains

```javascript
const chain = clip.getComponentChain(); // VideoComponentChain

// Enumerate effects
const count = chain.getComponentCount();
for (let i = 0; i < count; i++) {
  const component = chain.getComponentAtIndex(i);
  component.getDisplayName()   // "Opacity", "Motion", etc.
  component.getMatchName()     // Internal identifier

  // Enumerate parameters
  const paramCount = component.getParamCount();
  for (let p = 0; p < paramCount; p++) {
    const param = component.getParam(p);
    param.displayName          // "Scale", "Position", etc.
    param.getValueAtTime(time) // value at TickTime
    param.areKeyframesSupported()
    param.getKeyframeListAsTickTimes()
    // Action creators: createAddKeyframeAction, createRemoveKeyframeAction,
    // createSetValueAction, createSetTimeVaryingAction,
    // createSetInterpolationAtKeyframeAction
  }
}

// Add/remove effects (inside transaction)
chain.createAppendComponentAction(effect)
chain.createInsertComponentAction(effect, index)
chain.createRemoveComponentAction(component)

// Create effects
const matchNames = await ppro.VideoFilterFactory.getVideoFilterMatchNames();
const effect = ppro.VideoFilterFactory.createVideoFilter("some.match.name");
```

## AudioFilterFactory

```javascript
// Audio effects
const audioMatchNames = await ppro.AudioFilterFactory.getAudioFilterMatchNames();
const audioEffect = ppro.AudioFilterFactory.createAudioFilterByDisplayName("DeNoise");
// Apply via audioComponentChain.createInsertComponentAction()
```

## VideoFilterFactory Match Names

```javascript
// Common effect match names:
// "PR.ADBE Gamma Correction"    — Lumetri-style color
// "PR.ADBE Motion"              — Motion (built-in)
// "PR.ADBE Opacity"             — Opacity (built-in)
// "AE.ADBE Gaussian Blur 2"    — Gaussian Blur
// "AE.ADBE Title"              — Legacy Title
// Use getVideoFilterMatchNames() to discover available effects
```

## Exporter & Encoding

```javascript
// Export a single frame (bmp, dpx, gif, jpg, exr, png, tga, tif)
ppro.Exporter.exportSequenceFrame(sequence, tickTime, filename, filepath, width, height);

// Queue to Adobe Media Encoder
const encoder = ppro.EncoderManager.getManager();
encoder.isAMEInstalled           // boolean
encoder.exportSequence(sequence, presetPath, exportType)
// Events: encodeQueueStart, encodeRenderProgress, encodeComplete, encodeError, encodeCancelled

// Export to other formats
ppro.ProjectConverter // AAF, Final Cut Pro XML, OpenTimelineIO
```

## ProjectConverter

```javascript
// Open Timeline IO export
await ppro.ProjectConverter.exportAsOpenTimelineIO(sequence, "/path/output.otio");

// Other format converters
await ppro.ProjectConverter.exportAsAAF(sequence, "/path/output.aaf");
await ppro.ProjectConverter.exportAsFinalCutProXML(sequence, "/path/output.xml");
```

## Source Monitor

```javascript
ppro.SourceMonitor.openProjectItem(clipProjectItem)
ppro.SourceMonitor.openFilePath("/path/to/video.mp4")
ppro.SourceMonitor.play(1.0)                // normal speed
ppro.SourceMonitor.getPosition()            // TickTime
ppro.SourceMonitor.getProjectItem()         // ProjectItem
ppro.SourceMonitor.closeClip()
ppro.SourceMonitor.closeAllClips()
```

## EventManager

```javascript
ppro.EventManager.addGlobalEventListener(
  ppro.Constants.SequenceEvent.ACTIVE_SEQUENCE_CHANGED,
  (event) => { console.log("Sequence changed!", event); }
);

// Event categories:
// Constants.ProjectEvent — project-level events
// Constants.SequenceEvent — sequence-level events
// Constants.SnapEvent — snapping events
// Constants.OperationCompleteEvent — async operation completion

// Per-object event listening (alternative to global)
ppro.EventManager.addEventListener(project, "ProjectChanged", handler);
ppro.EventManager.addEventListener(sequence, "SequenceChanged", handler);
ppro.EventManager.addEventListener(track, "TrackChanged", handler);
ppro.EventManager.addEventListener(encoder, "EncodeComplete", handler);
```

## Properties (Custom Metadata)

```javascript
const props = ppro.Properties.getProperties(project); // or sequence

props.getValue("myKey")               // string
props.getValueAsBool("isEnabled")     // boolean
props.getValueAsFloat("ratio")        // number
props.getValueAsInt("count")          // number
props.hasValue("myKey")               // boolean

// Write values (inside transaction)
props.createSetValueAction("myKey", "myValue", persistenceFlag)
props.createClearValueAction("myKey")
```

## Constants Enumerations

```
MediaType, ContentType, ProjectItemColorLabel, TrackItemType,
TransitionPosition, InterpolationMode, PropertyType, SequenceEvent,
VideoTrackEvent, AudioTrackEvent, EncoderEvent,
ScratchDiskFolderType, ScratchDiskFolder, MetadataType, ExportType,
PreferenceKey, SnapEvent, OperationCompleteEvent,
PixelAspectRatio, VideoFieldType, VideoDisplayFormatType,
AudioChannelType, AudioDisplayFormatType, MarkerColor
```
