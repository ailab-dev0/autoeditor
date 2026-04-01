/**
 * Project loader — fetches project on selection, routes to correct shell state.
 *
 * Decision logic:
 *   1. Fetch project from backend
 *   2. Try to load blueprint (Stage 4A output) → has review data → REVIEWING
 *   3. Try to load edit_package (legacy) → has segments → REVIEWING
 *   4. Try to load marks → has segments → REVIEWING
 *   5. Nothing found → MEDIA_SELECT (run pipeline)
 *
 * When going to REVIEWING, data is always loaded into signals BEFORE transition.
 * User can re-run pipeline from the review screen via 'pipeline:rerun' event.
 */
import { segments, approvals, segmentsError } from '../segments/signals';
import { transcript } from '../transcript/signals';
import { graphData } from '../knowledge/signals';
import { parseSegments } from '../segments/protocol';
import { signal } from '@preact/signals';

/** Whether the current project has existing analysis data */
export const hasExistingData = signal(false);

/** The project status from the backend */
export const projectStatus = signal(null);

export function setupProjectLoader(bus, transport) {

  bus.on('project:loaded', async ({ projectId, projectName }) => {
    hasExistingData.value = false;
    projectStatus.value = null;

    // Step 1: Fetch project
    const res = await transport.get(`/api/projects/${projectId}`);
    if (!res.ok) {
      bus.emit('pipeline:go-media-select', { projectId, projectName });
      return;
    }

    const project = res.data?.project || res.data;
    projectStatus.value = project?.status || null;

    // Step 2: Try to load blueprint (Stage 4A output)
    let blueprintLoaded = false;
    try {
      const bpRes = await transport.get(`/api/projects/${projectId}/blueprint`);
      if (bpRes.ok && bpRes.data?.blueprint?.segments?.length > 0) {
        const bp = bpRes.data.blueprint;
        console.log(`[ProjectLoader] Blueprint found: ${bp.segments.length} segments`);

        // Convert blueprint segments to the format our signals expect
        const segs = bp.segments.map(s => ({
          id: s.segmentId,
          start: s.start,
          end: s.end,
          text: s.text,
          suggestion: s.suggestion === 'overlay' || s.suggestion === 'enhance' ? 'keep' : s.suggestion,
          confidence: s.confidence,
          explanation: s.explanation,
          videoPath: s.mediaPath,
          // Preserve blueprint-specific data
          topic: s.topic,
          role: s.role,
          importance: s.importance,
          aiAction: s.aiPath?.action,
          aiMaterial: s.aiPath?.material,
          aiReason: s.aiPath?.reason,
        }));

        segments.value = segs;
        const initial = {};
        for (const seg of segs) {
          // Respect existing user choices from review state
          const review = bpRes.data.reviewStats;
          initial[seg.id] = seg.userChoice === 'ai' ? 'approved'
            : seg.userChoice === 'original' ? 'rejected'
            : 'pending';
        }
        // Default all to pending — user reviews in the plugin
        for (const seg of segs) {
          if (!initial[seg.id]) initial[seg.id] = 'pending';
        }
        approvals.value = initial;
        segmentsError.value = null;
        hasExistingData.value = true;
        blueprintLoaded = true;
      }
    } catch (err) {
      console.warn('[ProjectLoader] Blueprint load failed:', err);
    }

    // Step 3: If no blueprint, try edit_package
    if (!blueprintLoaded) {
      const editPackage = project?.edit_package || project?.editPackage;
      if (editPackage && editPackage.videos && editPackage.videos.length > 0) {
        console.log('[ProjectLoader] Edit package found');
        try {
          const parsed = parseSegments(editPackage);
          if (parsed.length > 0) {
            segments.value = parsed;
            const initial = {};
            for (const seg of parsed) initial[seg.id] = 'pending';
            approvals.value = initial;
            segmentsError.value = null;
            hasExistingData.value = true;
          }
        } catch (err) {
          console.warn('[ProjectLoader] Failed to parse edit_package:', err);
        }
      }
    }

    // Step 4: If still nothing, try marks endpoint
    if (!hasExistingData.value) {
      try {
        const marksRes = await transport.get(`/api/projects/${projectId}/marks`);
        const marks = marksRes.ok ? (marksRes.data?.marks || marksRes.data?.segments || []) : [];
        if (marks.length > 0) {
          console.log(`[ProjectLoader] Marks found: ${marks.length}`);
          segments.value = Array.isArray(marks) ? marks : [];
          const initial = {};
          for (const seg of segments.value) initial[seg.id] = 'pending';
          approvals.value = initial;
          hasExistingData.value = true;
        }
      } catch {}
    }

    // Step 5: Also load transcript + knowledge if available
    if (hasExistingData.value) {
      transport.get(`/api/projects/${projectId}/transcript`).then(tRes => {
        if (tRes.ok && tRes.data) {
          const tData = tRes.data.transcripts?.[0] || tRes.data;
          if (tData.text || tData.segments) transcript.value = tData;
        }
      }).catch(() => {});

      transport.get(`/api/projects/${projectId}/knowledge`).then(kRes => {
        if (kRes.ok && kRes.data) {
          graphData.value = kRes.data;
        }
      }).catch(() => {});
    }

    // Route decision
    if (hasExistingData.value) {
      bus.emit('pipeline:go-reviewing', { projectId, projectName });
    } else {
      bus.emit('pipeline:go-media-select', { projectId, projectName });
    }
  });

  // Re-run pipeline: clear existing data and go to media select
  bus.on('pipeline:rerun', ({ projectId, projectName }) => {
    console.log('[ProjectLoader] Re-running pipeline — clearing existing data');
    segments.value = [];
    approvals.value = {};
    segmentsError.value = null;
    transcript.value = null;
    graphData.value = null;
    hasExistingData.value = false;
    projectStatus.value = null;
    bus.emit('pipeline:go-media-select', { projectId, projectName });
  });
}
