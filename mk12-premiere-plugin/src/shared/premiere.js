/**
 * Premiere Pro UXP API wrapper.
 *
 * Lazy module loading, safe() envelope, version fallback chains,
 * tick conversion. Ported from v1 PremiereAPI.js as functional exports.
 */

// ---------------------------------------------------------------------------
// Host module — lazy so unit tests don't blow up
// ---------------------------------------------------------------------------
let _ppro = null;

function ppro() {
  if (!_ppro) {
    try { _ppro = require('premierepro'); } catch (_) { _ppro = null; }
  }
  return _ppro;
}

// ---------------------------------------------------------------------------
// safe() envelope
// ---------------------------------------------------------------------------
async function safe(fn) {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    console.warn('[Premiere]', err);
    return { ok: false, error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Tick conversion
// ---------------------------------------------------------------------------
const TICKS_PER_SECOND = 254016000000;

function ticksToSeconds(ticks) {
  if (typeof ticks === 'number') return ticks / TICKS_PER_SECOND;
  if (typeof ticks === 'string') return parseInt(ticks, 10) / TICKS_PER_SECOND;
  return 0;
}

function secondsToTicks(seconds) {
  return Math.round(seconds * TICKS_PER_SECOND);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const OVERLAY_TRACK_NAME = 'EditorLens_V2';

const VIDEO_EXTENSIONS = new Set([
  'mp4', 'mov', 'mkv', 'avi', 'webm', 'mxf', 'prores', 'm4v', 'mts', 'ts',
  'mpg', 'mpeg', 'wmv', 'flv', 'f4v', 'vob', 'ogv', '3gp', 'braw', 'r3d',
  'ari', 'dpx', 'exr', 'mj2', 'h264', 'h265', 'hevc',
]);

const AUDIO_EXTENSIONS = new Set([
  'mp3', 'wav', 'aac', 'm4a', 'flac', 'ogg', 'wma', 'aiff', 'alac',
]);

const IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'psd', 'tiff', 'tif', 'bmp', 'gif', 'webp', 'svg',
  'ai', 'eps', 'raw', 'cr2', 'nef', 'dng',
]);

// ---------------------------------------------------------------------------
// Internal accessors
// ---------------------------------------------------------------------------
function _app() {
  const mod = ppro();
  if (!mod) return null;
  return mod.app || mod.Application || null;
}

async function _project() {
  const mod = ppro();
  if (mod?.Project && typeof mod.Project.getActiveProject === 'function') {
    try { return await mod.Project.getActiveProject(); } catch (_) {}
  }
  const app = _app();
  return app?.project || null;
}

async function _activeSequence() {
  const proj = await _project();
  if (!proj) return null;
  if (typeof proj.getActiveSequence === 'function') {
    try { return await proj.getActiveSequence(); } catch (_) {}
  }
  return proj.activeSequence || null;
}

async function _getClip(trackIndex, clipIndex) {
  const seq = await _activeSequence();
  if (!seq) throw new Error('No active sequence');

  const tracks = seq.videoTracks;
  if (!tracks) throw new Error('videoTracks unavailable');

  const track = tracks[trackIndex] || (tracks.getTrack ? tracks.getTrack(trackIndex) : null);
  if (!track) throw new Error(`Track ${trackIndex} not found`);

  let clips;
  if (typeof track.getClips === 'function') {
    clips = await track.getClips();
  } else {
    clips = track.clips;
  }
  if (!clips) throw new Error('clips unavailable');

  const clip = clips[clipIndex] || (clips.getClip ? clips.getClip(clipIndex) : null);
  if (!clip) throw new Error(`Clip ${clipIndex} not found on track ${trackIndex}`);
  return clip;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
async function getSequence() {
  return safe(async () => {
    const seq = await _activeSequence();
    if (!seq) throw new Error('No active sequence');

    let videoTracks = 0, audioTracks = 0, framerate = null, duration = 0;

    if (typeof seq.getVideoTrackCount === 'function') {
      videoTracks = await seq.getVideoTrackCount();
    } else if (seq.videoTracks) {
      videoTracks = seq.videoTracks.numTracks || seq.videoTracks.length || 0;
    }

    if (typeof seq.getAudioTrackCount === 'function') {
      audioTracks = await seq.getAudioTrackCount();
    } else if (seq.audioTracks) {
      audioTracks = seq.audioTracks.numTracks || seq.audioTracks.length || 0;
    }

    if (typeof seq.getSettings === 'function') {
      try {
        const settings = await seq.getSettings();
        if (settings) framerate = settings.videoFrameRate || null;
      } catch (_) {}
    }
    if (!framerate) framerate = seq.framerate || null;

    if (typeof seq.getEndTime === 'function') {
      const endTime = await seq.getEndTime();
      duration = endTime?.seconds != null ? endTime.seconds : 0;
    } else if (seq.end !== undefined) {
      duration = ticksToSeconds(seq.end);
    }

    return {
      name: seq.name || 'Untitled',
      duration,
      frameRate: framerate,
      videoTrackCount: videoTracks,
      audioTrackCount: audioTracks,
    };
  });
}

async function createMarker(trackIndex, time, duration, name, color, comment) {
  return safe(async () => {
    const mod = ppro();
    const seq = await _activeSequence();
    if (!seq) throw new Error('No active sequence');
    const proj = await _project();

    // UXP v25.0+ action-based markers
    if (mod?.Markers && typeof mod.Markers.getMarkers === 'function' &&
        proj && typeof proj.executeTransaction === 'function' && mod.TickTime) {
      const markers = mod.Markers.getMarkers(seq);
      if (markers && typeof markers.createAddMarkerAction === 'function') {
        const startTime = mod.TickTime.createWithSeconds(time);
        const durTime = mod.TickTime.createWithSeconds(duration || 0);
        let markerId = null;

        await proj.executeTransaction(async (compoundAction) => {
          const action = markers.createAddMarkerAction(
            String(name || ''), 'Comment', startTime, durTime, String(comment || '')
          );
          compoundAction.addAction(action);
        }, 'EditorLens marker');

        try {
          const allMarkers = await markers.getMarkers();
          if (allMarkers?.length > 0) {
            const last = allMarkers[allMarkers.length - 1];
            markerId = last.getName ? await last.getName() : null;
          }
        } catch (_) {}

        return { id: markerId, name, time, duration };
      }
    }

    // Legacy markers
    const legacyMarkers = seq.markers;
    if (!legacyMarkers) throw new Error('Markers API unavailable');

    const timeTicks = secondsToTicks(time);
    let marker;
    if (typeof legacyMarkers.createMarker === 'function') {
      marker = legacyMarkers.createMarker(timeTicks);
    } else if (typeof legacyMarkers.add === 'function') {
      marker = legacyMarkers.add(timeTicks);
    } else {
      throw new Error('Cannot create markers');
    }
    if (!marker) throw new Error('Marker creation returned null');

    if (name != null && 'name' in marker) marker.name = String(name);
    if (comment != null && 'comments' in marker) marker.comments = String(comment);
    if (comment != null && 'comment' in marker) marker.comment = String(comment);
    if (duration > 0 && 'end' in marker) marker.end = secondsToTicks(time + duration);
    if (color != null && 'colorIndex' in marker) marker.colorIndex = color;

    return { id: marker.guid || marker.id || null, name: marker.name || name, time, duration };
  });
}

async function removeClip(trackIndex, clipIndex) {
  return safe(async () => {
    const mod = ppro();
    const clip = await _getClip(trackIndex, clipIndex);
    const project = await _project();
    const seq = await _activeSequence();

    // UXP action-based removal
    if (project && mod?.SequenceEditor && seq) {
      try {
        const editor = mod.SequenceEditor.getEditor(seq);
        if (editor && typeof editor.createRemoveItemsAction === 'function') {
          const selection = seq.getSelection ? seq.getSelection() : null;
          if (selection) {
            seq.clearSelection();
            seq.setSelection({ trackItems: [clip] });
            const sel = seq.getSelection();
            await project.executeTransaction(async (ca) => {
              ca.addAction(editor.createRemoveItemsAction(sel, true, true));
            }, 'EditorLens remove clip');
            return { removed: true, trackIndex, clipIndex };
          }
        }
      } catch (e) {
        console.warn('[Premiere] UXP remove failed, trying legacy:', e.message);
      }
    }

    // Legacy
    if (typeof clip.remove === 'function') {
      clip.remove(true, true);
    } else if (typeof clip.deleteSelf === 'function') {
      clip.deleteSelf();
    } else {
      throw new Error('Clip removal API unavailable');
    }
    return { removed: true, trackIndex, clipIndex };
  });
}

async function trimClip(trackIndex, clipIndex, inPoint, outPoint) {
  return safe(async () => {
    const mod = ppro();
    const clip = await _getClip(trackIndex, clipIndex);
    const project = await _project();

    // UXP action-based
    if (project && typeof project.executeTransaction === 'function' &&
        typeof clip.createSetInPointAction === 'function') {
      await project.executeTransaction(async (ca) => {
        if (inPoint != null) {
          ca.addAction(clip.createSetInPointAction(mod.TickTime.createWithSeconds(inPoint)));
        }
        if (outPoint != null) {
          ca.addAction(clip.createSetOutPointAction(mod.TickTime.createWithSeconds(outPoint)));
        }
      }, 'EditorLens trim');
      return { trimmed: true, trackIndex, clipIndex, inPoint, outPoint };
    }

    // Legacy
    if (inPoint != null) {
      const ticks = secondsToTicks(inPoint);
      if ('inPoint' in clip) clip.inPoint = ticks;
      else if (typeof clip.setInPoint === 'function') clip.setInPoint(ticks);
    }
    if (outPoint != null) {
      const ticks = secondsToTicks(outPoint);
      if ('outPoint' in clip) clip.outPoint = ticks;
      else if (typeof clip.setOutPoint === 'function') clip.setOutPoint(ticks);
    }
    return { trimmed: true, trackIndex, clipIndex, inPoint, outPoint };
  });
}

async function setClipSpeed(trackIndex, clipIndex, speed) {
  return safe(async () => {
    const clip = await _getClip(trackIndex, clipIndex);
    if (typeof clip.setSpeed === 'function') clip.setSpeed(speed);
    else if ('speed' in clip) clip.speed = speed;
    else if (typeof clip.changeSpeed === 'function') clip.changeSpeed(speed);
    else throw new Error('setClipSpeed API unavailable');
    return { speed, trackIndex, clipIndex };
  });
}

async function moveClip(trackIndex, clipIndex, newPosition) {
  return safe(async () => {
    const mod = ppro();
    const clip = await _getClip(trackIndex, clipIndex);
    const project = await _project();

    // UXP action-based
    if (project && typeof project.executeTransaction === 'function' &&
        typeof clip.createMoveAction === 'function' && mod?.TickTime) {
      const tickTime = mod.TickTime.createWithSeconds(newPosition);
      await project.executeTransaction(async (ca) => {
        ca.addAction(clip.createMoveAction(tickTime));
      }, 'EditorLens move clip');
      return { moved: true, trackIndex, clipIndex, newPosition };
    }

    // Legacy
    const ticks = secondsToTicks(newPosition);
    if ('start' in clip) clip.start = ticks;
    else if (typeof clip.move === 'function') clip.move(ticks);
    else if (typeof clip.setStart === 'function') clip.setStart(ticks);
    else throw new Error('moveClip API unavailable');
    return { moved: true, trackIndex, clipIndex, newPosition };
  });
}

async function insertTransition(trackIndex, position, type, duration) {
  return safe(async () => {
    const seq = await _activeSequence();
    if (!seq) throw new Error('No active sequence');
    const proj = await _project();
    const posTicks = secondsToTicks(position);
    const durTicks = secondsToTicks(duration);

    if (proj && typeof proj.applyTransition === 'function') {
      proj.applyTransition(trackIndex, posTicks, type, durTicks);
      return { inserted: true, type, position, duration };
    }

    const tracks = seq.videoTracks;
    const track = tracks?.[trackIndex] || (tracks?.getTrack ? tracks.getTrack(trackIndex) : null);
    if (track && typeof track.insertTransition === 'function') {
      track.insertTransition(type, posTicks, durTicks);
      return { inserted: true, type, position, duration };
    }

    throw new Error('Transition API unavailable');
  });
}

/**
 * Get all media items from the Premiere project bin.
 * Returns flat array of { name, path, type, duration }.
 */
async function getProjectItems() {
  return safe(async () => {
    const proj = await _project();
    if (!proj) throw new Error('No active project');

    const rootItem = typeof proj.getRootItem === 'function'
      ? await proj.getRootItem()
      : proj.rootItem;
    if (!rootItem) throw new Error('Cannot access project root');

    const items = [];

    const mod = ppro();

    async function walkItems(parent) {
      // Use FolderItem.cast for proper UXP folder traversal
      let folder = parent;
      if (mod?.FolderItem && typeof mod.FolderItem.cast === 'function') {
        try {
          const cast = mod.FolderItem.cast(parent);
          if (cast) folder = cast;
        } catch (_) {}
      }

      let children;
      if (typeof folder.getItems === 'function') {
        children = await folder.getItems();
      } else {
        children = folder.children || folder.items || [];
      }

      for (let i = 0; i < children.length; i++) {
        const item = children[i];
        const name = item.name || '';

        // Check if it's a bin (folder) — recurse
        const isBin = item.type === 2 || item.type === 'bin';
        if (isBin) {
          await walkItems(item);
          continue;
        }

        // Also try: if FolderItem.cast succeeds and getItems exists, it's a folder
        if (!isBin && mod?.FolderItem && typeof mod.FolderItem.cast === 'function') {
          try {
            const castFolder = mod.FolderItem.cast(item);
            if (castFolder && typeof castFolder.getItems === 'function') {
              await walkItems(castFolder);
              continue;
            }
          } catch (_) {}
        }

        // Get the actual filesystem path using UXP ClipProjectItem.cast()
        // Rule: use ppro.ClipProjectItem.cast(item) → getMediaFilePath()
        let path = '';

        // Primary: UXP ClipProjectItem.cast → getMediaFilePath
        if (mod?.ClipProjectItem && typeof mod.ClipProjectItem.cast === 'function') {
          try {
            const castItem = mod.ClipProjectItem.cast(item);
            if (castItem && typeof castItem.getMediaFilePath === 'function') {
              path = await castItem.getMediaFilePath();
            }
          } catch (_) {}
        }

        // Fallback: direct getMediaFilePath on item
        if (!path) {
          try {
            if (typeof item.getMediaFilePath === 'function') {
              path = await item.getMediaFilePath();
            }
          } catch (_) {}
        }

        // Fallback: getMediaPath
        if (!path) {
          try {
            if (typeof item.getMediaPath === 'function') {
              path = await item.getMediaPath();
            }
          } catch (_) {}
        }

        // Final fallbacks
        if (!path) path = item.filePath || item.treePath || '';

        // Determine media type from extension
        const ext = (path || name).split('.').pop()?.toLowerCase() || '';
        let mediaType = 'unknown';
        if (VIDEO_EXTENSIONS.has(ext)) mediaType = 'video';
        else if (AUDIO_EXTENSIONS.has(ext)) mediaType = 'audio';
        else if (IMAGE_EXTENSIONS.has(ext)) mediaType = 'image';

        // Get duration
        let duration = 0;
        try {
          if (typeof item.getMediaDuration === 'function') {
            const d = await item.getMediaDuration();
            duration = d?.seconds ?? ticksToSeconds(d?.ticks ?? d ?? 0);
          } else if (item.duration) {
            duration = ticksToSeconds(item.duration);
          }
        } catch (_) {}

        items.push({ name, path, type: mediaType, duration });
      }
    }

    await walkItems(rootItem);
    return items;
  });
}

/**
 * Build a timeline from approved blueprint segments.
 *
 * For each segment (sorted by start time):
 *   1. Find the source clip in the project bin by matching mediaPath
 *   2. Insert it onto the timeline at the current playhead position
 *   3. Trim to the segment's in/out points (source start/end)
 *
 * All operations run inside a single transaction for undo support.
 *
 * @param {Array<{id, videoPath, start, end, suggestion, transition_after}>} segments
 * @param {(progress: {current: number, total: number, label: string}) => void} onProgress
 * @param {((videoPath: string) => Promise<string|null>)|null} downloadFn — downloads a file from backend, returns local path
 * @returns {Promise<{ok: boolean, data?: {executed: number}, error?: string}>}
 */
async function buildTimeline(segments, onProgress, downloadFn) {
  return safe(async () => {
    const mod = ppro();
    if (!mod) throw new Error('Premiere Pro API not available');

    const project = await _project();
    if (!project) throw new Error('No active project');

    const sequence = await _activeSequence();
    if (!sequence) throw new Error('No active sequence — open or create a sequence first');

    const editor = mod.SequenceEditor.getEditor(sequence);
    if (!editor) throw new Error('Cannot get sequence editor');

    // Sort segments by start time (chronological order for the edit)
    const sorted = segments.slice().sort((a, b) => a.start - b.start);

    // Filter out cuts — only keep/trim segments should be placed
    const toPlace = sorted.filter(s => s.suggestion !== 'cut');

    if (toPlace.length === 0) {
      throw new Error('No segments to place — all are marked as cut');
    }

    // Find source clips in the project bin
    const projectItems = await getProjectItems();
    if (!projectItems.ok) throw new Error('Cannot read project bin');

    // Build a path→projectItem lookup
    // We need the raw project items, not just our parsed list
    const rootItem = typeof project.getRootItem === 'function'
      ? await project.getRootItem()
      : project.rootItem;

    const clipItemMap = new Map();
    async function indexItems(parent) {
      let folder = parent;
      if (mod.FolderItem && typeof mod.FolderItem.cast === 'function') {
        try { const cast = mod.FolderItem.cast(parent); if (cast) folder = cast; } catch (_) {}
      }
      let children;
      if (typeof folder.getItems === 'function') children = await folder.getItems();
      else children = folder.children || folder.items || [];

      for (let i = 0; i < children.length; i++) {
        const item = children[i];
        const isBin = item.type === 2 || item.type === 'bin';
        if (isBin) { await indexItems(item); continue; }

        // Try to get the file path
        let path = '';
        if (mod.ClipProjectItem && typeof mod.ClipProjectItem.cast === 'function') {
          try {
            const castItem = mod.ClipProjectItem.cast(item);
            if (castItem && typeof castItem.getMediaFilePath === 'function') {
              path = await castItem.getMediaFilePath();
            }
          } catch (_) {}
        }
        if (!path && typeof item.getMediaFilePath === 'function') {
          try { path = await item.getMediaFilePath(); } catch (_) {}
        }
        if (path) clipItemMap.set(path, item);

        // Also index by filename for fuzzy matching
        const name = (path || item.name || '').split('/').pop()?.split('\\').pop() || '';
        if (name) clipItemMap.set(name, item);
      }
    }
    await indexItems(rootItem);

    // Execute as a single undo-able transaction
    let executed = 0;
    let timelinePosition = 0; // seconds — where the next clip goes

    await project.executeTransaction(async (compoundAction) => {
      for (let i = 0; i < toPlace.length; i++) {
        const seg = toPlace[i];
        onProgress({ current: i + 1, total: toPlace.length, label: `Placing segment ${i + 1}/${toPlace.length}` });

        // Find the source clip by path or filename
        const videoPath = seg.videoPath || '';
        const fileName = videoPath.split('/').pop()?.split('\\').pop() || '';
        let clipItem = clipItemMap.get(videoPath) || clipItemMap.get(fileName);

        // Fallback: if not in bin, try to download from backend and import
        if (!clipItem && videoPath && downloadFn) {
          onProgress({ current: i + 1, total: toPlace.length, label: `Downloading ${fileName}...` });
          try {
            const localPath = await downloadFn(videoPath);
            if (localPath) {
              // Create an "EditorLens" bin if it doesn't exist
              let targetBin = rootItem;
              try {
                const items = typeof rootItem.getItems === 'function' ? await rootItem.getItems() : [];
                const existing = items.find(it => it.name === 'EditorLens Imports');
                if (existing) {
                  targetBin = existing;
                } else if (typeof rootItem.createBin === 'function') {
                  targetBin = await rootItem.createBin('EditorLens Imports');
                }
              } catch (_) { /* use root */ }

              await project.importFiles([localPath], true, targetBin, false);

              // Re-index to find the newly imported item
              clipItemMap.clear();
              await indexItems(rootItem);
              clipItem = clipItemMap.get(localPath) || clipItemMap.get(fileName);
            }
          } catch (err) {
            console.warn(`[premiere] Failed to download/import ${videoPath}:`, err);
          }
        }

        if (!clipItem) {
          console.warn(`[premiere] Source clip not found in bin or backend: ${videoPath}`);
          continue;
        }

        // Set source in/out points on the clip before inserting
        const castClip = mod.ClipProjectItem.cast(clipItem);
        if (castClip && seg.start != null && seg.end != null) {
          const inTicks = secondsToTicks(seg.start);
          const outTicks = secondsToTicks(seg.end);
          const setInOutAction = castClip.setInOutPointsAction(
            { seconds: seg.start, ticks: String(inTicks) },
            { seconds: seg.end, ticks: String(outTicks) }
          );
          if (setInOutAction) compoundAction.addAction(setInOutAction);
        }

        // Insert at current timeline position
        const insertTicks = secondsToTicks(timelinePosition);
        const insertAction = editor.createInsertProjectItemAction(
          clipItem,
          { seconds: timelinePosition, ticks: String(insertTicks) },
          0, // video track index
          0  // audio track index
        );

        if (insertAction) {
          compoundAction.addAction(insertAction);
          // Advance timeline position by segment duration
          const segDuration = (seg.end || 0) - (seg.start || 0);
          timelinePosition += segDuration;
          executed++;
        }
      }
    }, 'EditorLens: Import to Timeline');

    return { executed, totalDuration: timelinePosition };
  });
}

export {
  safe,
  TICKS_PER_SECOND,
  ticksToSeconds,
  secondsToTicks,
  OVERLAY_TRACK_NAME,
  VIDEO_EXTENSIONS,
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  getSequence,
  createMarker,
  removeClip,
  trimClip,
  setClipSpeed,
  moveClip,
  insertTransition,
  getProjectItems,
  buildTimeline,
};
