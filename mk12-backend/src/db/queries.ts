/**
 * Pre-built Cypher queries for common operations.
 *
 * Each function returns { cypher, params } for use with the neo4j driver.
 */

// ──────────────────────────────────────────────────────────────────
// Projects
// ──────────────────────────────────────────────────────────────────

export const projectQueries = {
  create: (id: string, name: string, status: string) => ({
    cypher: `
      CREATE (p:Project {
        id: $id, name: $name, status: $status,
        created_at: datetime(), updated_at: datetime()
      })
      RETURN p
    `,
    params: { id, name, status },
  }),

  getById: (id: string) => ({
    cypher: `MATCH (p:Project {id: $id}) RETURN p`,
    params: { id },
  }),

  getAll: () => ({
    cypher: `MATCH (p:Project) RETURN p ORDER BY p.created_at DESC`,
    params: {},
  }),

  updateStatus: (id: string, status: string) => ({
    cypher: `
      MATCH (p:Project {id: $id})
      SET p.status = $status, p.updated_at = datetime()
      RETURN p
    `,
    params: { id, status },
  }),

  remove: (id: string) => ({
    cypher: `
      MATCH (p:Project {id: $id})
      OPTIONAL MATCH (p)-[r]-()
      DELETE r, p
    `,
    params: { id },
  }),
};

// ──────────────────────────────────────────────────────────────────
// Videos
// ──────────────────────────────────────────────────────────────────

export const videoQueries = {
  addToProject: (projectId: string, videoPath: string, duration?: number, fps?: number) => ({
    cypher: `
      MATCH (p:Project {id: $projectId})
      MERGE (v:Video {path: $videoPath})
      ON CREATE SET v.duration = $duration, v.fps = $fps
      MERGE (p)-[:HAS_VIDEO]->(v)
      RETURN v
    `,
    params: { projectId, videoPath, duration: duration ?? null, fps: fps ?? null },
  }),
};

// ──────────────────────────────────────────────────────────────────
// Segments
// ──────────────────────────────────────────────────────────────────

export const segmentQueries = {
  create: (segment: {
    id: string;
    videoPath: string;
    start: number;
    end: number;
    suggestion: string;
    confidence: number;
    explanation: string;
    chapter?: string;
    transcript?: string;
  }) => ({
    cypher: `
      MATCH (v:Video {path: $videoPath})
      CREATE (s:Segment {
        id: $id, start: $start, end: $end,
        suggestion: $suggestion, confidence: $confidence,
        explanation: $explanation, chapter: $chapter,
        transcript: $transcript,
        approved: false, rejected: false
      })
      MERGE (v)-[:HAS_SEGMENT]->(s)
      RETURN s
    `,
    params: {
      id: segment.id,
      videoPath: segment.videoPath,
      start: segment.start,
      end: segment.end,
      suggestion: segment.suggestion,
      confidence: segment.confidence,
      explanation: segment.explanation,
      chapter: segment.chapter ?? null,
      transcript: segment.transcript ?? null,
    },
  }),

  getByProject: (projectId: string) => ({
    cypher: `
      MATCH (p:Project {id: $projectId})-[:HAS_VIDEO]->(v)-[:HAS_SEGMENT]->(s)
      RETURN s, v.path AS videoPath
      ORDER BY s.start
    `,
    params: { projectId },
  }),

  getFiltered: (projectId: string, filters: {
    decision?: string;
    minConfidence?: number;
    maxConfidence?: number;
    chapter?: string;
  }) => {
    let where = '';
    const conditions: string[] = [];
    if (filters.decision) conditions.push('s.suggestion = $decision');
    if (filters.minConfidence !== undefined) conditions.push('s.confidence >= $minConfidence');
    if (filters.maxConfidence !== undefined) conditions.push('s.confidence <= $maxConfidence');
    if (filters.chapter) conditions.push('s.chapter = $chapter');
    if (conditions.length > 0) where = 'WHERE ' + conditions.join(' AND ');

    return {
      cypher: `
        MATCH (p:Project {id: $projectId})-[:HAS_VIDEO]->(v)-[:HAS_SEGMENT]->(s)
        ${where}
        RETURN s, v.path AS videoPath
        ORDER BY s.start
      `,
      params: {
        projectId,
        decision: filters.decision ?? null,
        minConfidence: filters.minConfidence ?? null,
        maxConfidence: filters.maxConfidence ?? null,
        chapter: filters.chapter ?? null,
      },
    };
  },

  approve: (segmentId: string) => ({
    cypher: `
      MATCH (s:Segment {id: $segmentId})
      SET s.approved = true, s.rejected = false
      RETURN s
    `,
    params: { segmentId },
  }),

  reject: (segmentId: string, overrideDecision?: string) => ({
    cypher: `
      MATCH (s:Segment {id: $segmentId})
      SET s.approved = false, s.rejected = true,
          s.override_decision = $overrideDecision
      RETURN s
    `,
    params: { segmentId, overrideDecision: overrideDecision ?? null },
  }),

  bulkUpdate: (segmentIds: string[], approved: boolean) => ({
    cypher: `
      MATCH (s:Segment) WHERE s.id IN $segmentIds
      SET s.approved = $approved, s.rejected = NOT $approved
      RETURN s
    `,
    params: { segmentIds, approved },
  }),
};

// ──────────────────────────────────────────────────────────────────
// Knowledge Graph — Concepts
// ──────────────────────────────────────────────────────────────────

export const conceptQueries = {
  create: (concept: {
    id: string;
    label: string;
    type: string;
    importance: number;
    community?: number;
  }) => ({
    cypher: `
      CREATE (c:Concept {
        id: $id, label: $label, type: $type,
        importance: $importance, community: $community
      })
      RETURN c
    `,
    params: {
      id: concept.id,
      label: concept.label,
      type: concept.type,
      importance: concept.importance,
      community: concept.community ?? null,
    },
  }),

  linkToSegment: (conceptId: string, segmentId: string) => ({
    cypher: `
      MATCH (c:Concept {id: $conceptId}), (s:Segment {id: $segmentId})
      MERGE (s)-[:COVERS_CONCEPT]->(c)
    `,
    params: { conceptId, segmentId },
  }),

  addPrerequisite: (fromId: string, toId: string, weight: number) => ({
    cypher: `
      MATCH (a:Concept {id: $fromId}), (b:Concept {id: $toId})
      MERGE (a)-[:PREREQUISITE_OF {weight: $weight}]->(b)
    `,
    params: { fromId, toId, weight },
  }),

  addBuildsUpon: (fromId: string, toId: string, weight: number) => ({
    cypher: `
      MATCH (a:Concept {id: $fromId}), (b:Concept {id: $toId})
      MERGE (a)-[:BUILDS_UPON {weight: $weight}]->(b)
    `,
    params: { fromId, toId, weight },
  }),

  getByProject: (projectId: string) => ({
    cypher: `
      MATCH (p:Project {id: $projectId})-[:HAS_VIDEO]->()-[:HAS_SEGMENT]->(s)-[:COVERS_CONCEPT]->(c)
      RETURN DISTINCT c
      ORDER BY c.importance DESC
    `,
    params: { projectId },
  }),

  getGraph: (projectId: string) => ({
    cypher: `
      MATCH (p:Project {id: $projectId})-[:HAS_VIDEO]->()-[:HAS_SEGMENT]->(s)-[:COVERS_CONCEPT]->(c)
      WITH collect(DISTINCT c) AS concepts
      UNWIND concepts AS c
      OPTIONAL MATCH (c)-[r:PREREQUISITE_OF|BUILDS_UPON|RELATES_TO]->(c2)
      WHERE c2 IN concepts
      RETURN c AS node, collect({target: c2.id, type: type(r), weight: r.weight}) AS edges
    `,
    params: { projectId },
  }),
};

// ──────────────────────────────────────────────────────────────────
// Chapters
// ──────────────────────────────────────────────────────────────────

export const chapterQueries = {
  create: (chapter: { id: string; projectId: string; name: string; order: number; targetDuration: number }) => ({
    cypher: `
      MATCH (p:Project {id: $projectId})
      CREATE (ch:Chapter {id: $id, name: $name, order: $order, target_duration: $targetDuration})
      MERGE (p)-[:HAS_CHAPTER]->(ch)
      RETURN ch
    `,
    params: {
      id: chapter.id,
      projectId: chapter.projectId,
      name: chapter.name,
      order: chapter.order,
      targetDuration: chapter.targetDuration,
    },
  }),

  linkSegment: (chapterName: string, segmentId: string) => ({
    cypher: `
      MATCH (ch:Chapter {name: $chapterName}), (s:Segment {id: $segmentId})
      MERGE (s)-[:IN_CHAPTER]->(ch)
    `,
    params: { chapterName, segmentId },
  }),
};

// ──────────────────────────────────────────────────────────────────
// Transcript
// ──────────────────────────────────────────────────────────────────

export const transcriptQueries = {
  create: (transcript: { id: string; projectId: string; videoPath: string; language: string; model: string }) => ({
    cypher: `
      MATCH (p:Project {id: $projectId}), (v:Video {path: $videoPath})
      CREATE (t:Transcript {
        id: $id, language: $language, model: $model,
        created_at: datetime()
      })
      MERGE (v)-[:HAS_TRANSCRIPT]->(t)
      RETURN t
    `,
    params: {
      id: transcript.id,
      projectId: transcript.projectId,
      videoPath: transcript.videoPath,
      language: transcript.language,
      model: transcript.model,
    },
  }),

  getByProject: (projectId: string) => ({
    cypher: `
      MATCH (p:Project {id: $projectId})-[:HAS_VIDEO]->(v)-[:HAS_TRANSCRIPT]->(t)
      RETURN t, v.path AS videoPath
    `,
    params: { projectId },
  }),
};
