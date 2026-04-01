# Premiere Pro UXP Host API Reference

> Source: Official Adobe `types.d.ts` from [AdobeDocs/uxp-premiere-pro](https://github.com/AdobeDocs/uxp-premiere-pro/blob/main/src/pages/ppro_reference/types.d.ts) and [AdobeDocs/uxp-premiere-pro-samples](https://github.com/AdobeDocs/uxp-premiere-pro-samples). API version: Premiere Pro 25.6+.

---

## Entry Point

```js
const ppro = require("premierepro");
```

The `premierepro` module exposes 50+ static class references:

```
AppPreference, AudioClipTrackItem, AudioComponentChain, AudioFilterComponent,
AudioFilterFactory, AudioTrack, CaptionTrack, ClipProjectItem, EncoderManager,
Exporter, FolderItem, FrameRate, Guid, Keyframe, Marker, Markers, Metadata,
OperationCompleteEvent, PRProduction, Project, ProjectClosedEvent,
ProjectConverter, ProjectEvent, ProjectItem, ProjectSettings, ProjectUtils,
Properties, ScratchDiskSettings, Sequence, SequenceEditor, SequenceSettings,
SequenceUtils, SnapEvent, SourceMonitor, TextSegments, TickTime,
TrackItemSelection, TransitionFactory, UniqueSerializeable, Utils,
VideoClipTrackItem, VideoComponentChain, VideoFilterComponent,
VideoFilterFactory, VideoTrack, VideoTransition, EventManager, Transcript,
AddTransitionOptions, Constants
```

---

## Core Architecture Pattern: Action-Based Transactions

ALL mutations use a 3-layer pattern:

```js
project.lockedAccess(() => {                         // 1. Lock project state
  project.executeTransaction((compoundAction) => {   // 2. Start undoable txn
    const action = thing.createSomethingAction(...); // 3. Create action
    compoundAction.addAction(action);                // 4. Add to compound
  }, "Undo label string");
});
```

### Key Rules
- `lockedAccess(callback)` -- guarantees project state won't change during callback
- `executeTransaction(callback, undoString?)` -- creates an undoable operation; returns `boolean`
- `CompoundAction.addAction(action)` -- adds action; can add multiple before commit
- `CompoundAction.empty` -- readonly boolean, true if no actions added
- Action objects are created via `create*Action()` methods on domain objects
- Actions MUST be created AND executed inside the transaction callback
- Read-only operations (get*) are async Promises; Action creation is synchronous

---

## Class Hierarchy

### Project

```ts
// Static
Project.createProject(path: string): Promise<Project>
Project.isProject(projectPath: string): boolean
Project.open(path: string, openProjectOptions?: OpenProjectOptions): Promise<Project>
Project.getActiveProject(): Promise<Project>
Project.getProject(projectGuid: Guid): Project

// Instance
project.getActiveSequence(): Promise<Sequence>
project.setActiveSequence(sequence: Sequence): Promise<boolean>
project.createSequence(name: string, presetPath?: string): Promise<Sequence>
project.createSequenceFromMedia(name: string, clipProjectItems?: ClipProjectItem[], targetBin?: ProjectItem): Promise<Sequence>
project.getColorSettings(): Promise<ProjectColorSettings>
project.deleteSequence(sequence: Sequence): Promise<boolean>
project.getInsertionBin(): Promise<ProjectItem>
project.openSequence(sequence: Sequence): Promise<boolean>
project.closeSequence(sequence: Sequence): Promise<boolean>
project.importSequences(projectPath: string, sequenceIds?: Guid[]): Promise<boolean>
project.importAEComps(aepPath: string, compNames: string[], TargetBin?: ProjectItem): Promise<boolean>
project.importAllAEComps(aepPath: string, TargetBin?: ProjectItem): Promise<boolean>
project.importFiles(filePaths: string[], suppressUI?: boolean, targetBin?: ProjectItem, asNumberedStills?: boolean): Promise<boolean>
project.close(closeProjectOptions?: CloseProjectOptions): Promise<boolean>
project.save(): Promise<boolean>
project.saveAs(path: string): Promise<boolean>
project.getSequence(guid: Guid): Sequence
project.getSequences(): Promise<Sequence[]>
project.getRootItem(): Promise<FolderItem>
project.pauseGrowing(pause: boolean): Promise<boolean>
project.executeTransaction(callback: (compoundAction: CompoundAction) => void, undoString?: string): boolean
project.lockedAccess(callback: () => void): void

// Readonly Properties
project.guid: Guid
project.name: string
project.path: string
```

### ProjectItem (base for all bin items)

```ts
// Static
ProjectItem.cast(item: FolderItem | ClipProjectItem): ProjectItem
ProjectItem.TYPE_CLIP: number
ProjectItem.TYPE_BIN: number
ProjectItem.TYPE_ROOT: number
ProjectItem.TYPE_FILE: number
ProjectItem.TYPE_STYLE: number
ProjectItem.TYPE_COMPOUND: number

// Instance
projectItem.createSetNameAction(inName: string): Action
projectItem.getColorLabelIndex(): Promise<number>
projectItem.createSetColorLabelAction(inColorLabelIndex: number): Action
projectItem.getProject(): Promise<Project>
projectItem.getId(): string
projectItem.getParentBin(): FolderItem
projectItem.type: number  // readonly
projectItem.name: string  // readonly
```

### ClipProjectItem (extends ProjectItem concept)

```ts
// Static -- CAST is required to access clip-specific methods
ClipProjectItem.cast(projectItem: ProjectItem): ClipProjectItem

// Instance
clipItem.getInputLUTID(): Promise<string>
clipItem.createSetInputLUTIDAction(stringLUTID: string): Action
clipItem.isSequence(): Promise<boolean>
clipItem.canChangeMediaPath(): Promise<boolean>
clipItem.isOffline(): Promise<boolean>
clipItem.canProxy(): Promise<boolean>
clipItem.getProxyPath(): Promise<string>
clipItem.hasProxy(): Promise<boolean>
clipItem.attachProxy(mediaPath: string, isHiRes: boolean, inMakeAlternateLinkInTeamProjects?: boolean): Promise<boolean>
clipItem.findItemsMatchingMediaPath(matchString: string, ignoreSubclips?: boolean): Promise<ProjectItem[]>
clipItem.refreshMedia(): Promise<boolean>
clipItem.createSetOfflineAction(): Action
clipItem.getFootageInterpretation(): Promise<FootageInterpretation>
clipItem.createSetFootageInterpretationAction(footageInterpretation: FootageInterpretation): Action
clipItem.changeMediaFilePath(newPath: string, overrideCompatibilityCheck?: boolean): Promise<boolean>
clipItem.isMergedClip(): Promise<boolean>
clipItem.isMulticamClip(): Promise<boolean>
clipItem.getEmbeddedLUTID(): Promise<string>
clipItem.createSetScaleToFrameSizeAction(): Action
clipItem.createSetNameAction(inName: string): Action
clipItem.getColorLabelIndex(): Promise<number>
clipItem.createSetColorLabelAction(inColorLabelIndex: number): Action
clipItem.getProject(): Promise<Project>
clipItem.getContentType(): Promise<Constants.ContentType>
clipItem.getSequence(): Promise<Sequence>
clipItem.getInPoint(mediaType: Constants.MediaType): Promise<TickTime>
clipItem.getOutPoint(mediaType: Constants.MediaType): Promise<TickTime>
clipItem.getMediaFilePath(): Promise<string>
clipItem.getComponentChain(mediaType: Constants.MediaType): Promise<string>
clipItem.createSetInPointAction(tickTime: TickTime): Action
clipItem.createSetOverridePixelAspectRatioAction(inNumerator: number, inDenominator: number): Action
clipItem.createSetOverrideFrameRateAction(inOverriddenFrameRateValue: number): Action
clipItem.createSetOutPointAction(tickTime: TickTime): Action
clipItem.createSetInOutPointsAction(inPoint: TickTime, outPoint: TickTime): Action
clipItem.createClearInOutPointsAction(): Action
clipItem.getMedia(): Promise<Media>
clipItem.getOriginatingProjectPath(): Promise<string>
clipItem.type: number   // readonly
clipItem.name: string   // readonly
```

### FolderItem (bin)

```ts
// Static
FolderItem.cast(projectItem: ProjectItem): FolderItem

// Instance
folder.createBinAction(name: string, makeUnique: boolean): Action
folder.createSmartBinAction(name: string, searchQuery: string): Action
folder.createRenameBinAction(name: string): Action
folder.getItems(): Promise<ProjectItem[]>
folder.createRemoveItemAction(item: ProjectItem): Action
folder.createMoveItemAction(item: ProjectItem, newParent: FolderItem): Action
folder.createSetNameAction(inName: string): Action
folder.getColorLabelIndex(): Promise<number>
folder.createSetColorLabelAction(inColorLabelIndex: number): Action
folder.getProject(): Promise<Project>
folder.type: number   // readonly
folder.name: string   // readonly
```

---

### Sequence

```ts
sequence.getSequenceVideoTimeDisplayFormat(): Promise<TimeDisplay>
sequence.getSequenceAudioTimeDisplayFormat(): Promise<TimeDisplay>
sequence.getPlayerPosition(): Promise<TickTime>
sequence.setPlayerPosition(positionTime?: TickTime): Promise<boolean>
sequence.clearSelection(): Promise<boolean>
sequence.setSelection(trackItemSelection: TrackItemSelection): Promise<boolean>
sequence.getVideoTrackCount(): Promise<number>
sequence.getAudioTrackCount(): Promise<number>
sequence.getCaptionTrackCount(): Promise<number>
sequence.getVideoTrack(trackIndex: number): Promise<VideoTrack>
sequence.getAudioTrack(trackIndex: number): Promise<AudioTrack>
sequence.getCaptionTrack(trackIndex: number): Promise<CaptionTrack>
sequence.getSettings(): Promise<SequenceSettings>
sequence.createSetSettingsAction(sequenceSettings: SequenceSettings): Action
sequence.createCloneAction(): Action
sequence.createSubsequence(ignoreTrackTargeting?: boolean): Promise<Sequence>
sequence.isDoneAnalyzingForVideoEffects(): Promise<boolean>
sequence.getZeroPoint(): Promise<TickTime>
sequence.getEndTime(): Promise<TickTime>
sequence.getInPoint(): Promise<TickTime>
sequence.getOutPoint(): Promise<TickTime>
sequence.createSetInPointAction(tickTime: TickTime): Action
sequence.createSetZeroPointAction(tickTime: TickTime): Action
sequence.createSetOutPointAction(tickTime: TickTime): Action
sequence.getProjectItem(): Promise<ProjectItem>
sequence.getSelection(): Promise<TrackItemSelection>
sequence.getFrameSize(): Promise<RectF>
sequence.getTimebase(): Promise<string>
sequence.guid: Guid    // readonly
sequence.name: string  // readonly
```

### SequenceEditor (timeline manipulation)

```ts
// Static
SequenceEditor.getEditor(sequenceObject: Sequence): SequenceEditor
SequenceEditor.getInstalledMogrtPath(): Promise<string>

// Instance -- ALL methods return Actions (must be used in executeTransaction)
editor.createRemoveItemsAction(
  trackItemSelection: TrackItemSelection,
  ripple: boolean,
  mediaType: Constants.MediaType,
  shiftOverLapping?: boolean
): Action

editor.createInsertProjectItemAction(
  projectItem: ProjectItem,
  time: TickTime,
  videoTrackIndex: number,
  audioTrackIndex: number,
  limitShift: boolean
): Action

editor.createOverwriteItemAction(
  projectItem: ProjectItem,
  time: TickTime,
  videoTrackIndex: number,
  audioTrackIndex: number
): Action

editor.createCloneTrackItemAction(
  trackItem: VideoClipTrackItem | AudioClipTrackItem,
  timeOffset: TickTime,
  videoTrackVerticalOffset: number,
  audioTrackVerticalOffset: number,
  alignToVideo: boolean,
  isInsert: boolean
): Action

// MOGRT insertion (not action-based, runs directly in lockedAccess)
editor.insertMogrtFromPath(
  inMGTPath: string,
  inTime: TickTime,
  inVideoTrackIndex: number,
  inAudioTrackIndex: number
): (VideoClipTrackItem | AudioClipTrackItem)[]

editor.insertMogrtFromLibrary(
  inLibraryName: string,
  inElementName: string,
  inTime: TickTime,
  inVideoTrackIndex: number,
  inAudioTrackIndex: number
): (VideoClipTrackItem | AudioClipTrackItem)[]
```

---

### VideoTrack / AudioTrack

```ts
// Static Events
VideoTrack.EVENT_TRACK_CHANGED: string
VideoTrack.EVENT_TRACK_INFO_CHANGED: string
VideoTrack.EVENT_TRACK_LOCK_CHANGED: string

// Instance
track.setMute(mute: boolean): Promise<boolean>
track.getMediaType(): Promise<Guid>
track.getIndex(): Promise<number>
track.isMuted(): Promise<boolean>
track.getTrackItems(trackItemType: Constants.TrackItemType, includeEmptyTrackItems: boolean): VideoClipTrackItem[] | AudioClipTrackItem[]
track.name: string  // readonly
track.id: number    // readonly
```

### VideoClipTrackItem / AudioClipTrackItem

```ts
// Static Type Constants
VideoClipTrackItem.TRACKITEMTYPE_EMPTY: number    // 0
VideoClipTrackItem.TRACKITEMTYPE_CLIP: number     // 1
VideoClipTrackItem.TRACKITEMTYPE_TRANSITION: number // 2
VideoClipTrackItem.TRACKITEMTYPE_PREVIEW: number  // 3
VideoClipTrackItem.TRACKITEMTYPE_FEEDBACK: number // 4

// Instance -- READ
trackItem.getMatchName(): Promise<string>
trackItem.getName(): Promise<string>
trackItem.getIsSelected(): Promise<boolean>
trackItem.getSpeed(): Promise<number>
trackItem.isAdjustmentLayer(): Promise<boolean>
trackItem.isSpeedReversed(): Promise<number>
trackItem.getInPoint(): Promise<TickTime>      // relative to source media start
trackItem.getOutPoint(): Promise<TickTime>     // relative to source media start
trackItem.getStartTime(): Promise<TickTime>    // position in sequence
trackItem.getEndTime(): Promise<TickTime>      // position in sequence
trackItem.getDuration(): Promise<TickTime>
trackItem.getType(): Promise<number>
trackItem.isDisabled(): Promise<boolean>
trackItem.getMediaType(): Promise<Guid>
trackItem.getTrackIndex(): Promise<number>
trackItem.getProjectItem(): Promise<ProjectItem>
trackItem.getComponentChain(): Promise<VideoComponentChain | AudioComponentChain>

// Instance -- ACTIONS (mutations)
trackItem.createMoveAction(tickTime: TickTime): Action           // shift in-point by time offset
trackItem.createSetInPointAction(tickTime: TickTime): Action     // trim source in
trackItem.createSetOutPointAction(tickTime: TickTime): Action    // trim source out
trackItem.createSetStartAction(tickTime: TickTime): Action       // set sequence start time
trackItem.createSetEndAction(tickTime: TickTime): Action         // set sequence end time
trackItem.createSetDisabledAction(disabled: boolean): Action
trackItem.createSetNameAction(inName: string): Action

// Video-only: Transitions
videoTrackItem.createAddVideoTransitionAction(videoTransition: VideoTransition, options?: AddTransitionOptions): Action
videoTrackItem.createRemoveVideoTransitionAction(transitionPosition?: Constants.TransitionPosition): Action
```

### TrackItemSelection

```ts
// Static
TrackItemSelection.createEmptySelection(callback: (selection: TrackItemSelection) => void): boolean

// Instance
selection.addItem(trackItem: VideoClipTrackItem | AudioClipTrackItem, skipDuplicateCheck?: boolean): boolean
selection.removeItem(trackItem: VideoClipTrackItem | AudioClipTrackItem): boolean
selection.getTrackItems(): Promise<(VideoClipTrackItem | AudioClipTrackItem)[]>
```

---

### Markers

```ts
// Static
Markers.getMarkers(markerOwnerObject: Sequence | ClipProjectItem): Promise<Markers>

// Instance
markers.getMarkers(filters?: string[]): Marker[]  // synchronous!
markers.createRemoveMarkerAction(marker: Marker): Action
markers.createMoveMarkerAction(marker: Marker, tickTime: TickTime): Action
markers.createAddMarkerAction(
  Name: string,
  markerType?: string,           // Marker.MARKER_TYPE_COMMENT etc
  startTime?: TickTime,
  duration?: TickTime,
  comments?: string
): Action
```

### Marker

```ts
// Static Type Constants
Marker.MARKER_TYPE_COMMENT: string
Marker.MARKER_TYPE_CHAPTER: string
Marker.MARKER_TYPE_FLVCUEPOINT: string
Marker.MARKER_TYPE_WEBLINK: string

// Instance -- READ
marker.getColor(): Color
marker.getColorIndex(): number
marker.getComments(): string
marker.getDuration(): TickTime
marker.getName(): string
marker.getUrl(): string
marker.getTarget(): string
marker.getType(): string
marker.getStart(): TickTime

// Instance -- ACTIONS
marker.createSetColorByIndexAction(colorIndex: number): Action
marker.createSetNameAction(name: string): Action
marker.createSetDurationAction(tickTime: TickTime): Action
marker.createSetTypeAction(markerType: string): Action
marker.createSetCommentsAction(comments: string): Action
```

---

### Effects & Component Chain

```ts
// Video Effects Factory
VideoFilterFactory.createComponent(matchName: string): Promise<VideoFilterComponent>
VideoFilterFactory.getMatchNames(): Promise<string[]>
VideoFilterFactory.getDisplayNames(): Promise<string[]>

// Audio Effects Factory
AudioFilterFactory.createComponentByDisplayName(displayName: string, inAudioClipTrackItem: AudioClipTrackItem): Promise<AudioFilterComponent>
AudioFilterFactory.getDisplayNames(): Promise<string[]>

// Component Chain (Video or Audio)
chain.createInsertComponentAction(component: Component | FilterComponent, componentInsertionIndex: number): Action
chain.createAppendComponentAction(component: Component | FilterComponent): Action
chain.createRemoveComponentAction(component: Component | FilterComponent): Action
chain.getComponentAtIndex(componentIndex: number): Component
chain.getComponentCount(): number

// Component (individual effect instance)
component.getParam(paramIndex?: number): ComponentParam
component.getMatchName(): Promise<string>
component.getDisplayName(): Promise<string>
component.getParamCount(): number

// ComponentParam (effect parameter)
param.createKeyframe(inValue: number | string | boolean | PointF | Color): Keyframe
param.getValueAtTime(time: TickTime): Promise<number | string | boolean | PointF | Color>
param.findNearestKeyframe(inTime: TickTime, outTime: TickTime): Keyframe
param.findNextKeyframe(inTime: TickTime): Keyframe
param.findPreviousKeyframe(inTime: TickTime): Keyframe
param.createRemoveKeyframeAction(inTime: TickTime, UpdateUI?: boolean): Action
param.createRemoveKeyframeRangeAction(inTime: TickTime, outTime: TickTime, UpdateUI?: boolean): Action
param.createSetValueAction(inKeyFrame: Keyframe, inSafeForPlayback?: boolean): Action
param.createAddKeyframeAction(inKeyFrame: Keyframe): Action
param.createSetTimeVaryingAction(inTimeVarying: boolean): Action
param.createSetInterpolationAtKeyframeAction(inTime: TickTime, InterpolationMode: number, UpdateUI?: boolean): Action
param.getStartValue(): Promise<Keyframe>
param.getKeyframeListAsTickTimes(): TickTime[]
param.getKeyframePtr(time?: TickTime): Keyframe
param.isTimeVarying(): boolean
param.areKeyframesSupported(): Promise<boolean>
param.displayName: string  // readonly
```

### Transitions

```ts
// Factory
TransitionFactory.createVideoTransition(matchName: string): VideoTransition
TransitionFactory.getVideoTransitionMatchNames(): Promise<string[]>

// AddTransitionOptions (builder pattern)
const opts = ppro.AddTransitionOptions();
opts.setApplyToStart(true);           // start or end of trackItem
opts.setForceSingleSided(false);      // one/both sides
opts.setTransitionAlignment(number);
opts.setDuration(tickTime: TickTime);
```

---

### TickTime

```ts
// Static Constructors
TickTime.createWithSeconds(seconds: number): TickTime
TickTime.createWithTicks(ticks: string): TickTime
TickTime.createWithFrameAndFrameRate(frameCount: number, frameRate: FrameRate): TickTime

// Static Constants
TickTime.TIME_ZERO: TickTime
TickTime.TIME_ONE_SECOND: TickTime
TickTime.TIME_ONE_MINUTE: TickTime
TickTime.TIME_ONE_HOUR: TickTime
TickTime.TIME_MAX: TickTime
TickTime.TIME_MIN: TickTime
TickTime.TIME_INVALID: TickTime

// Instance -- READ
tickTime.seconds: number       // readonly
tickTime.ticks: string         // readonly (ticks as string)
tickTime.ticksNumber: number   // readonly (ticks as number)

// Instance -- Arithmetic (returns new TickTime, does NOT mutate)
tickTime.add(other: TickTime): TickTime
tickTime.subtract(other: TickTime): TickTime
tickTime.multiply(factor: number): TickTime
tickTime.divide(divisor: number): TickTime

// Instance -- Frame alignment
tickTime.alignToNearestFrame(frameRate: FrameRate): TickTime
tickTime.alignToFrame(frameRate: FrameRate): TickTime  // floor

// Instance -- Comparison
tickTime.equals(other: TickTime): boolean
```

**Ticks per second constant**: `254016000000` (used in frame-rate math)

### FrameRate

```ts
FrameRate.createWithValue(value: number): FrameRate
frameRate.ticksPerFrame: number  // read/write
frameRate.value: number          // readonly (fps)
frameRate.equals(other: FrameRate): boolean
```

---

### Export / Render

```ts
// Frame export (still image)
Exporter.exportSequenceFrame(
  sequence: Sequence,
  time: TickTime,
  filename: string,    // e.g. 'output.png'
  filepath: string,    // e.g. '/tmp/'
  width: number,
  height: number
): Promise<boolean>
// Supported formats: bmp, dpx, gif, jpg, exr, png, tga, tif

// Sequence export (video)
const encoder = ppro.EncoderManager.getManager();
encoder.exportSequence(
  sequence: Sequence,
  exportType: Constants.ExportType,  // IMMEDIATELY, QUEUE_TO_AME, QUEUE_TO_APP
  outputFile?: string,
  presetFile?: string,               // .epr preset file
  exportFull?: boolean
): Promise<boolean>

encoder.encodeProjectItem(
  clipProjectItem: ClipProjectItem,
  outputFile?: string,
  presetFile?: string,
  workArea?: number,
  removeUponCompletion?: boolean,
  startQueueImmediately?: boolean
): Promise<boolean>

encoder.encodeFile(
  filePath: string,
  outputFile?: string,
  presetFile?: string,
  inPoint: TickTime,
  outPoint: TickTime,
  workArea?: number,
  removeUponCompletion?: boolean,
  startQueueImmediately?: boolean
): Promise<boolean>

encoder.isAMEInstalled: boolean  // readonly

// Export file extension lookup
EncoderManager.getExportFileExtension(sequence: Sequence, presetFilePath: string): Promise<string>

// Timeline format conversion
ProjectConverter.exportAsFinalCutProXML(sequence: Sequence, outputFilePath: string, suppressUI?: boolean): Promise<boolean>
ProjectConverter.exportAsOpenTimelineIO(sequence: Sequence, outputFilePath: string, suppressUI?: boolean): Promise<boolean>
```

---

### Events

```ts
// Add/remove listeners
EventManager.addEventListener(
  target: Project | Sequence | VideoTrack | AudioTrack | EncoderManager,
  eventName: string,
  eventHandler: (event?: object) => void,
  inCapturePhase?: boolean
): void

EventManager.removeEventListener(target, eventName, eventHandler): void

// Global listeners (no specific target)
EventManager.addGlobalEventListener(eventName, eventHandler, inCapturePhase?): void
EventManager.removeGlobalEventListener(eventName, eventHandler): void

// Event Types
Constants.ProjectEvent: OPENED, CLOSED, DIRTY, ACTIVATED, PROJECT_ITEM_SELECTION_CHANGED
Constants.SequenceEvent: ACTIVATED, CLOSED, SELECTION_CHANGED
Constants.VideoTrackEvent: TRACK_CHANGED, INFO_CHANGED, LOCK_CHANGED
Constants.AudioTrackEvent: TRACK_CHANGED, INFO_CHANGED, LOCK_CHANGED
Constants.EncoderEvent: RENDER_COMPLETE, RENDER_ERROR, RENDER_CANCEL, RENDER_QUEUE, RENDER_PROGRESS
Constants.SnapEvent: KEYFRAME, RAZOR_PLAYHEAD, RAZOR_MARKER, TRACKITEM, GUIDES, PLAYHEAD_TRACKITEM
Constants.OperationCompleteEvent: CLIP_EXTEND_REACHED, EFFECT_DROP_COMPLETE, EFFECT_DRAG_OVER, EXPORT_MEDIA_COMPLETE, GENERATIVE_EXTEND_COMPLETE, IMPORT_MEDIA_COMPLETE
```

---

### Metadata

```ts
Metadata.getProjectMetadata(projectItem: ProjectItem): Promise<string>
Metadata.getXMPMetadata(projectItem: ProjectItem): Promise<string>
Metadata.createSetProjectMetadataAction(projectItem: ProjectItem, metadata: string, updatedFields: string[]): Action
Metadata.createSetXMPMetadataAction(projectItem: ProjectItem, metadata: string): Action
Metadata.addPropertyToProjectMetadataSchema(name: string, label: string, type: number): Promise<boolean>
Metadata.getProjectColumnsMetadata(projectItem: ProjectItem): Promise<string>
Metadata.getProjectPanelMetadata(): Promise<string>
Metadata.setProjectPanelMetadata(metadata: string): Promise<boolean>

// Metadata types
Metadata.METADATA_TYPE_INTEGER / REAL / TEXT / BOOLEAN
```

### Transcript

```ts
Transcript.importFromJSON(jsonString: string): TextSegments
Transcript.createImportTextSegmentsAction(textSegments: TextSegments, clipProjectItem: ClipProjectItem): Action
Transcript.exportToJSON(clipProjectItem: ClipProjectItem): Promise<string>
```

### Properties (key-value store on Project/Sequence)

```ts
Properties.getProperties(owner: Project | Sequence): Promise<Properties>
props.getValueAsInt(name: string): number
props.getValueAsFloat(name: string): number
props.getValueAsBool(name: string): boolean
props.getValue(name: string): string
props.createSetValueAction(name: string, value: boolean | string | number, persistenceFlag: Constants.PropertyType): Action
props.hasValue(name: string): boolean
props.createClearValueAction(name: string): Action
```

### SourceMonitor

```ts
SourceMonitor.openFilePath(filePath: string): Promise<boolean>
SourceMonitor.openProjectItem(projectItem: ProjectItem): Promise<boolean>
SourceMonitor.closeClip(): Promise<boolean>
SourceMonitor.closeAllClips(): Promise<boolean>
SourceMonitor.getPosition(): Promise<TickTime>
SourceMonitor.play(speed?: number): Promise<boolean>
SourceMonitor.getProjectItem(): Promise<ProjectItem>
```

### SequenceUtils (AI features)

```ts
SequenceUtils.performSceneEditDetectionOnSelection(clipOperation: string, trackItemSelection: TrackItemSelection): Promise<boolean>
SequenceUtils.SEQUENCE_OPERATION_APPLYCUT: string
SequenceUtils.SEQUENCE_OPERATION_CREATEMARKER: string
SequenceUtils.SEQUENCE_OPERATION_CREATESUBCLIP: string
```

### UniqueSerializeable

```ts
UniqueSerializeable.cast(item: ProjectItem | ClipProjectItem | FolderItem | Sequence): UniqueSerializeable
serializable.getUniqueID(): Guid
```

---

## Constants (Enums)

```ts
Constants.MediaType          { ANY, DATA, VIDEO, AUDIO }
Constants.ContentType        { ANY, SEQUENCE, MEDIA }
Constants.TrackItemType      { EMPTY, CLIP, TRANSITION, PREVIEW, FEEDBACK }
Constants.TransitionPosition { START, END }
Constants.ExportType         { QUEUE_TO_AME, QUEUE_TO_APP, IMMEDIATELY }
Constants.InterpolationMode  { BEZIER, HOLD, LINEAR, TIME, TIME_TRANSITION_END, TIME_TRANSITION_START }
Constants.PropertyType       { PERSISTENT, NON_PERSISTENT }
Constants.MetadataType       { INTEGER, REAL, TEXT, BOOLEAN }
Constants.MarkerColor        { GREEN, RED, MAGNETA, ORANGE, YELLOW, BLUE, CYAN }
Constants.ProjectItemColorLabel { VIOLET, IRIS, LAVENDER, CERULEAN, FOREST, ROSE, MANGO, PURPLE, BLUE, TEAL, MAGENTA, TAN, GREEN, BROWN, YELLOW }
Constants.VideoFieldType     { PROGRESSIVE, UPPER_FIRST, LOWER_FIRST }
Constants.VideoDisplayFormatType { FPS_23_976, FPS_25, FPS_29_97, FPS_29_97_NON_DROP, FEET_FRAME_16mm, FEET_FRAME_35mm, FRAMES }
Constants.AudioChannelType   { MONO, STEREO, SURROUND_51, MULTI }
Constants.AudioDisplayFormatType { SAMPLE_RATE, MILLISECONDS }
Constants.PixelAspectRatio   { SQUARE, DVNTSC, DVNTSCWide, DVPAL, DVPALWide, Anamorphic, HDAnamorphic1080, DVCProHD }
Constants.ProjectEvent       { OPENED, CLOSED, DIRTY, ACTIVATED, PROJECT_ITEM_SELECTION_CHANGED }
Constants.SequenceEvent      { ACTIVATED, CLOSED, SELECTION_CHANGED }
Constants.SequenceOperation  { APPLYCUT, CREATEMARKER, CREATESUBCLIP }
Constants.SnapEvent          { KEYFRAME, RAZOR_PLAYHEAD, RAZOR_MARKER, TRACKITEM, GUIDES, PLAYHEAD_TRACKITEM }
Constants.OperationCompleteEvent { CLIP_EXTEND_REACHED, EFFECT_DROP_COMPLETE, EFFECT_DRAG_OVER, EXPORT_MEDIA_COMPLETE, GENERATIVE_EXTEND_COMPLETE, IMPORT_MEDIA_COMPLETE }
Constants.OperationCompleteState { SUCCESS, CANCELLED, FAILED }
```

---

## Complete Code Examples (from Adobe official samples)

### Insert a clip into a sequence

```js
const ppro = require("premierepro");

async function insertClip() {
  const project = await ppro.Project.getActiveProject();
  const rootItem = await project.getRootItem();
  const items = await rootItem.getItems();
  const sequence = await project.getActiveSequence();
  const seqEditor = ppro.SequenceEditor.getEditor(sequence);
  const insertionTime = ppro.TickTime.createWithSeconds(3);

  // Find item by name
  let itemToInsert;
  for (let i = 0; i < items.length; i++) {
    if (items[i].name === "MyClip.MOV") {
      itemToInsert = items[i];
      break;
    }
  }

  project.lockedAccess(() => {
    project.executeTransaction((compoundAction) => {
      const action = seqEditor.createInsertProjectItemAction(
        itemToInsert,
        insertionTime,
        0,  // video track index (V1)
        0,  // audio track index (A1)
        true // limitShift: only shift input track
      );
      compoundAction.addAction(action);
    }, "Insert clip");
  });
}
```

### Overwrite a clip

```js
project.lockedAccess(() => {
  project.executeTransaction((compoundAction) => {
    const action = seqEditor.createOverwriteItemAction(
      projectItem,
      ppro.TickTime.TIME_ZERO,
      1, // V2
      1  // A2
    );
    compoundAction.addAction(action);
  }, "Overwrite clip");
});
```

### Remove clips (ripple delete)

```js
const selection = await sequence.getSelection();
const seqEditor = ppro.SequenceEditor.getEditor(sequence);

project.lockedAccess(() => {
  project.executeTransaction((compoundAction) => {
    const action = seqEditor.createRemoveItemsAction(
      selection,
      true, // ripple
      ppro.Constants.MediaType.VIDEO
    );
    compoundAction.addAction(action);
  }, "Ripple delete");
});
```

### Clone a track item

```js
const selection = await sequence.getSelection();
const items = await selection.getTrackItems();
const seqEditor = ppro.SequenceEditor.getEditor(sequence);

project.lockedAccess(() => {
  project.executeTransaction((compoundAction) => {
    const action = seqEditor.createCloneTrackItemAction(
      items[0],
      ppro.TickTime.createWithSeconds(-1), // shift 1s earlier
      1,    // video track offset +1
      1,    // audio track offset +1
      true, // alignToVideo
      true  // isInsert (vs overwrite)
    );
    compoundAction.addAction(action);
  }, "Clone clip");
});
```

### Trim a clip end

```js
const selection = await sequence.getSelection();
const items = await selection.getTrackItems();
const oldEnd = await items[0].getEndTime();
const newEnd = ppro.TickTime.createWithSeconds(oldEnd.seconds - 1.0);

project.lockedAccess(() => {
  project.executeTransaction((compoundAction) => {
    compoundAction.addAction(items[0].createSetEndAction(newEnd));
  }, "Trim end by 1 second");
});
```

### Add handles (precise frame-level trimming)

```js
const ticksPerSec = 254016000000;
const projItem = await trackItem.getProjectItem();
const clipProjItem = ppro.ClipProjectItem.cast(projItem);
const footageInterpretation = await clipProjItem.getFootageInterpretation();
const projItemTimeBase = footageInterpretation.getFrameRate();
const projItemFrameRate = ppro.FrameRate.createWithValue(projItemTimeBase);

const inPointOffset = ppro.TickTime.createWithFrameAndFrameRate(frames, projItemFrameRate);
// ... calculate new in/out points accounting for source:sequence timebase ratio
```

### Add a marker

```js
const sequenceMarkers = await ppro.Markers.getMarkers(sequence);

project.lockedAccess(() => {
  project.executeTransaction((compoundAction) => {
    const action = sequenceMarkers.createAddMarkerAction(
      "ChapterName",
      ppro.Marker.MARKER_TYPE_CHAPTER,
      ppro.TickTime.createWithSeconds(5.0),
      ppro.TickTime.TIME_ZERO,  // duration
      "This is a chapter marker"
    );
    compoundAction.addAction(action);
  });
});
```

### Remove all markers

```js
const sequenceMarkers = await ppro.Markers.getMarkers(sequence);
const markerList = sequenceMarkers.getMarkers(); // sync!

project.lockedAccess(() => {
  project.executeTransaction((compoundAction) => {
    for (const marker of markerList) {
      compoundAction.addAction(sequenceMarkers.createRemoveMarkerAction(marker));
    }
  });
});
```

### Apply a video effect

```js
const filterFactory = ppro.VideoFilterFactory;
const videoTrack = await sequence.getVideoTrack(0);
const trackItems = videoTrack.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
const componentChain = await trackItems[0].getComponentChain();
const newEffect = await filterFactory.createComponent("PR.ADBE Gamma Correction");

project.lockedAccess(() => {
  project.executeTransaction((compoundAction) => {
    compoundAction.addAction(
      componentChain.createInsertComponentAction(newEffect, 2)
    );
  }, "Add effect");
});
```

### Apply an audio effect

```js
const audioTrack = await sequence.getAudioTrack(0);
const audioItems = audioTrack.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
const audioChain = await audioItems[0].getComponentChain();
const audioEffect = await ppro.AudioFilterFactory.createComponentByDisplayName(
  "Vocal Enhancer", audioItems[0]
);

project.lockedAccess(() => {
  project.executeTransaction((compoundAction) => {
    compoundAction.addAction(
      audioChain.createInsertComponentAction(audioEffect, 2)
    );
  }, "Add audio effect");
});
```

### Set effect parameter value

```js
const chain = await trackItem.getComponentChain();
const component = chain.getComponentAtIndex(1);  // 0 = Motion, 1 = Opacity typically
const param = component.getParam(1);
const keyframe = param.createKeyframe(300);

project.lockedAccess(() => {
  // First disable time-varying
  project.executeTransaction((compoundAction) => {
    compoundAction.addAction(param.createSetTimeVaryingAction(false));
  }, "Disable time varying");

  // Then set static value
  project.executeTransaction((compoundAction) => {
    compoundAction.addAction(param.createSetValueAction(keyframe, true));
  }, "Set value");
});
```

### Add keyframe with interpolation

```js
project.lockedAccess(() => {
  project.executeTransaction((compoundAction) => {
    const keyframe = param.createKeyframe(500);
    keyframe.position = ppro.TickTime.createWithSeconds(1);
    compoundAction.addAction(param.createAddKeyframeAction(keyframe));
  }, "Add keyframe");

  project.executeTransaction((compoundAction) => {
    compoundAction.addAction(
      param.createSetInterpolationAtKeyframeAction(
        ppro.TickTime.createWithSeconds(1),
        ppro.Constants.InterpolationMode.BEZIER
      )
    );
  }, "Set bezier interpolation");
});
```

### Add video transition

```js
const matchnames = await ppro.TransitionFactory.getVideoTransitionMatchNames();
const transition = await ppro.TransitionFactory.createVideoTransition(matchnames[0]);
const opts = ppro.AddTransitionOptions();
opts.setApplyToStart(true);

project.lockedAccess(() => {
  project.executeTransaction((compoundAction) => {
    compoundAction.addAction(
      videoTrackItem.createAddVideoTransitionAction(transition, opts)
    );
  }, "Add transition");
});
```

### Remove transition

```js
project.lockedAccess(() => {
  project.executeTransaction((compoundAction) => {
    compoundAction.addAction(
      videoTrackItem.createRemoveVideoTransitionAction(
        ppro.Constants.TransitionPosition.START
      )
    );
  }, "Remove transition");
});
```

### Export sequence frame

```js
const playerPos = await sequence.getPlayerPosition();
await ppro.Exporter.exportSequenceFrame(
  sequence, playerPos, "output.png", "/tmp/", 1920, 1080
);
```

### Export sequence to video

```js
const encoder = ppro.EncoderManager.getManager();
await encoder.exportSequence(
  sequence,
  ppro.Constants.ExportType.IMMEDIATELY,
  "/tmp/output.mpg",
  "/path/to/preset.epr"
);
```

### Create a bin

```js
const rootItem = await project.getRootItem();
project.lockedAccess(() => {
  project.executeTransaction((compoundAction) => {
    compoundAction.addAction(rootItem.createBinAction("NewBin", true));
  });
});
```

### Import files

```js
await project.importFiles(
  ["/path/to/video.mp4", "/path/to/audio.wav"],
  true,  // suppressUI
  null,  // target bin (null = root)
  false  // asNumberedStills
);
```

### Import transcript

```js
const textSegments = ppro.Transcript.importFromJSON(jsonString);
project.lockedAccess(() => {
  project.executeTransaction((compoundAction) => {
    compoundAction.addAction(
      ppro.Transcript.createImportTextSegmentsAction(textSegments, clipProjectItem)
    );
  });
});
```

### Listen to events

```js
ppro.EventManager.addEventListener(
  sequence,
  ppro.Constants.SequenceEvent.SELECTION_CHANGED,
  (event) => { console.log("Selection changed", event); }
);

// Global listener
ppro.EventManager.addGlobalEventListener(
  ppro.Constants.ProjectEvent.OPENED,
  (event) => { console.log("Project opened", event); }
);
```

---

## Key Gotchas

1. **cast() is required** to access type-specific methods: `ClipProjectItem.cast(projectItem)`, `FolderItem.cast(projectItem)`
2. **Actions created outside executeTransaction will fail** -- create them inside the callback
3. **getTrackItems() on VideoTrack is synchronous** (returns array directly), but most other reads are async
4. **Markers.getMarkers() instance method is synchronous** (the static `Markers.getMarkers(owner)` is async)
5. **TickTime arithmetic returns new objects** -- never mutates the original
6. **Track indices are 0-based** -- V1=0, V2=1, etc. Passing an index greater than track count auto-creates a new track
7. **lockedAccess is synchronous** -- the callback should not be async
8. **Component index 0 = Motion, 1 = Opacity** for built-in video effects on clips
9. **Effect matchNames** use the format `PR.ADBE <name>` for Premiere native, `AE.ADBE <name>` for After Effects
10. **insertMogrtFromPath is NOT action-based** -- runs directly in lockedAccess, not in executeTransaction
