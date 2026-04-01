/**
 * Export format generators.
 *
 * Converts segments and edit packages into various industry-standard
 * export formats for NLE interoperability.
 */

import type { Segment, EditPackageV3 } from '../types/index.js';

// ──────────────────────────────────────────────────────────────────
// CSV
// ──────────────────────────────────────────────────────────────────

/**
 * Generate CSV with columns: id, start, end, decision, confidence, concept, transcript
 */
export function toCSV(segments: Segment[]): string {
  const header = 'id,start,end,decision,confidence,chapter,concepts,transcript';
  const rows = segments.map((seg) => {
    const decision = seg.override_decision ?? seg.suggestion;
    const concepts = (seg.concepts ?? []).join('; ');
    const transcript = escapeCSV(seg.transcript ?? '');
    return `${seg.id},${seg.start},${seg.end},${decision},${seg.confidence},${escapeCSV(seg.chapter ?? '')},${escapeCSV(concepts)},${transcript}`;
  });

  return [header, ...rows].join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ──────────────────────────────────────────────────────────────────
// EDL (CMX3600)
// ──────────────────────────────────────────────────────────────────

/**
 * Generate CMX3600 EDL format.
 */
export function toEDL(segments: Segment[], fps: number = 24): string {
  const lines: string[] = [
    'TITLE: EditorLens MK-12 Export',
    'FCM: NON-DROP FRAME',
    '',
  ];

  let editNumber = 1;
  let recordTC = 0; // running record timecode in seconds

  const keptSegments = segments.filter(
    (s) => (s.override_decision ?? s.suggestion) !== 'cut'
  );

  for (const seg of keptSegments) {
    const sourceIn = formatTimecode(seg.start, fps);
    const sourceOut = formatTimecode(seg.end, fps);
    const recordIn = formatTimecode(recordTC, fps);
    const recordOut = formatTimecode(recordTC + (seg.end - seg.start), fps);

    // EDL edit line: EDIT# REEL TRACK TRANSITION SOURCE_IN SOURCE_OUT RECORD_IN RECORD_OUT
    const editNum = String(editNumber).padStart(3, '0');
    lines.push(`${editNum}  AX       V     C        ${sourceIn} ${sourceOut} ${recordIn} ${recordOut}`);

    // Optional: add comment with explanation
    if (seg.explanation) {
      lines.push(`* FROM CLIP NAME: Segment ${seg.id}`);
      lines.push(`* COMMENT: ${seg.explanation}`);
    }

    lines.push('');
    recordTC += seg.end - seg.start;
    editNumber++;
  }

  return lines.join('\n');
}

// ──────────────────────────────────────────────────────────────────
// FCPXML (Final Cut Pro XML)
// ──────────────────────────────────────────────────────────────────

/**
 * Generate Final Cut Pro XML (FCPXML) format.
 */
export function toFCPXML(
  segments: Segment[],
  metadata: { projectName: string; fps: number; sessionId?: string }
): string {
  const fps = metadata.fps || 24;
  const frameDuration = `${Math.round(1000 / fps) * 100}/100000s`;

  const keptSegments = segments.filter(
    (s) => (s.override_decision ?? s.suggestion) !== 'cut'
  );

  let offset = 0;
  const assetClips = keptSegments.map((seg, i) => {
    const duration = seg.end - seg.start;
    const startFrames = Math.round(seg.start * fps);
    const durationFrames = Math.round(duration * fps);
    const offsetFrames = Math.round(offset * fps);

    const clip = `            <asset-clip ref="r${i + 1}" offset="${offsetFrames}/${fps}s" name="Segment ${seg.id}" start="${startFrames}/${fps}s" duration="${durationFrames}/${fps}s">
                <note>${xmlEscape(seg.explanation ?? '')}</note>
            </asset-clip>`;

    offset += duration;
    return clip;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
    <resources>
        <format id="r0" name="FFVideoFormat${fps}p" frameDuration="${frameDuration}" width="1920" height="1080"/>
    </resources>
    <library>
        <event name="${xmlEscape(metadata.projectName)}">
            <project name="${xmlEscape(metadata.projectName)} - EditorLens">
                <sequence format="r0">
                    <spine>
${assetClips}
                    </spine>
                </sequence>
            </project>
        </event>
    </library>
</fcpxml>`;
}

// ──────────────────────────────────────────────────────────────────
// Premiere XML (FCP7 XML — Premiere compatible)
// ──────────────────────────────────────────────────────────────────

/**
 * Generate FCP7 XML format (Premiere Pro compatible).
 */
export function toPremiereXML(
  segments: Segment[],
  metadata: { projectName: string; fps: number; sessionId?: string }
): string {
  const fps = metadata.fps || 24;
  const keptSegments = segments.filter(
    (s) => (s.override_decision ?? s.suggestion) !== 'cut'
  );

  let sequenceDuration = 0;
  const clipItems = keptSegments.map((seg, i) => {
    const duration = seg.end - seg.start;
    const startFrame = Math.round(seg.start * fps);
    const endFrame = Math.round(seg.end * fps);
    const inPoint = Math.round(sequenceDuration * fps);
    const outPoint = Math.round((sequenceDuration + duration) * fps);

    const clip = `                    <clipitem id="clipitem-${i + 1}">
                        <name>Segment ${seg.id}</name>
                        <duration>${Math.round(duration * fps)}</duration>
                        <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
                        <start>${inPoint}</start>
                        <end>${outPoint}</end>
                        <in>${startFrame}</in>
                        <out>${endFrame}</out>
                        <comments>
                            <mastercomment1>${xmlEscape(seg.explanation ?? '')}</mastercomment1>
                            <mastercomment2>${xmlEscape(seg.suggestion)} (${Math.round(seg.confidence * 100)}%)</mastercomment2>
                        </comments>
                    </clipitem>`;

    sequenceDuration += duration;
    return clip;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
    <sequence>
        <name>${xmlEscape(metadata.projectName)} - EditorLens</name>
        <duration>${Math.round(sequenceDuration * fps)}</duration>
        <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
        <media>
            <video>
                <track>
${clipItems}
                </track>
            </video>
        </media>
    </sequence>
</xmeml>`;
}

// ──────────────────────────────────────────────────────────────────
// JSON
// ──────────────────────────────────────────────────────────────────

/**
 * Export raw EditPackageV3 as formatted JSON.
 */
export function toJSON(editPackage: EditPackageV3): string {
  return JSON.stringify(editPackage, null, 2);
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

/**
 * Format seconds as SMPTE timecode (HH:MM:SS:FF).
 */
function formatTimecode(seconds: number, fps: number): string {
  const totalFrames = Math.round(seconds * fps);
  const ff = totalFrames % fps;
  const ss = Math.floor(totalFrames / fps) % 60;
  const mm = Math.floor(totalFrames / (fps * 60)) % 60;
  const hh = Math.floor(totalFrames / (fps * 3600));

  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}:${pad2(ff)}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
