/**
 * Neo4j schema initialization.
 *
 * Creates constraints, indexes, and ensures the graph schema
 * is ready for ALL node types used by the backend.
 *
 * Node types: Project, Video, Segment, Transcript, TranscriptSegment,
 *             Concept, Chapter, PipelineStatus, ContentMark, User
 *
 * Relationships: HAS_VIDEO, BELONGS_TO, HAS_SEGMENT, HAS_TRANSCRIPT,
 *                PART_OF, COVERS_CONCEPT, IN_CHAPTER, PREREQUISITE_OF,
 *                BUILDS_UPON, RELATES_TO, COVERED_IN, STATUS_OF,
 *                TRANSCRIBES
 */

import { writeQuery, ensureConnected } from './neo4j.js';

/**
 * Initialize the graph schema — safe to call multiple times (idempotent).
 * Throws if Neo4j is not connected.
 */
export async function initializeSchema(): Promise<void> {
  ensureConnected();

  console.log('[schema] Initializing Neo4j schema...');

  // ── Constraints ──────────────────────────────────────────────
  const constraints = [
    'CREATE CONSTRAINT project_id IF NOT EXISTS FOR (p:Project) REQUIRE p.id IS UNIQUE',
    'CREATE CONSTRAINT video_path IF NOT EXISTS FOR (v:Video) REQUIRE v.path IS UNIQUE',
    'CREATE CONSTRAINT segment_id IF NOT EXISTS FOR (s:Segment) REQUIRE s.id IS UNIQUE',
    'CREATE CONSTRAINT concept_id IF NOT EXISTS FOR (c:Concept) REQUIRE c.id IS UNIQUE',
    'CREATE CONSTRAINT chapter_id IF NOT EXISTS FOR (ch:Chapter) REQUIRE ch.id IS UNIQUE',
    'CREATE CONSTRAINT transcript_id IF NOT EXISTS FOR (t:Transcript) REQUIRE t.id IS UNIQUE',
    'CREATE CONSTRAINT transcript_segment_id IF NOT EXISTS FOR (ts:TranscriptSegment) REQUIRE ts.id IS UNIQUE',
    'CREATE CONSTRAINT pipeline_status_id IF NOT EXISTS FOR (ps:PipelineStatus) REQUIRE ps.session_id IS UNIQUE',
    'CREATE CONSTRAINT content_mark_id IF NOT EXISTS FOR (cm:ContentMark) REQUIRE cm.id IS UNIQUE',
    'CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE',
    'CREATE CONSTRAINT user_email IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE',
  ];

  for (const cypher of constraints) {
    try {
      await writeQuery(cypher);
    } catch (err) {
      // Constraint may already exist in older Neo4j versions — not fatal
      console.warn(`[schema] Constraint warning: ${(err as Error).message}`);
    }
  }

  // ── Indexes ──────────────────────────────────────────────────
  const indexes = [
    // Project indexes
    'CREATE INDEX project_name IF NOT EXISTS FOR (p:Project) ON (p.name)',
    'CREATE INDEX project_status IF NOT EXISTS FOR (p:Project) ON (p.status)',
    'CREATE INDEX project_created IF NOT EXISTS FOR (p:Project) ON (p.created_at)',

    // Segment indexes
    'CREATE INDEX segment_suggestion IF NOT EXISTS FOR (s:Segment) ON (s.suggestion)',
    'CREATE INDEX segment_confidence IF NOT EXISTS FOR (s:Segment) ON (s.confidence)',
    'CREATE INDEX segment_chapter IF NOT EXISTS FOR (s:Segment) ON (s.chapter)',
    'CREATE INDEX segment_approved IF NOT EXISTS FOR (s:Segment) ON (s.approved)',
    'CREATE INDEX segment_start IF NOT EXISTS FOR (s:Segment) ON (s.start)',

    // Concept indexes
    'CREATE INDEX concept_label IF NOT EXISTS FOR (c:Concept) ON (c.label)',
    'CREATE INDEX concept_importance IF NOT EXISTS FOR (c:Concept) ON (c.importance)',
    'CREATE INDEX concept_community IF NOT EXISTS FOR (c:Concept) ON (c.community)',
    'CREATE INDEX concept_project IF NOT EXISTS FOR (c:Concept) ON (c.project_id)',

    // Transcript indexes
    'CREATE INDEX transcript_video IF NOT EXISTS FOR (t:Transcript) ON (t.video_path)',
    'CREATE INDEX transcript_created IF NOT EXISTS FOR (t:Transcript) ON (t.created_at)',

    // TranscriptSegment indexes
    'CREATE INDEX tseg_start IF NOT EXISTS FOR (ts:TranscriptSegment) ON (ts.start)',

    // Chapter indexes
    'CREATE INDEX chapter_project IF NOT EXISTS FOR (ch:Chapter) ON (ch.project_id)',
    'CREATE INDEX chapter_order IF NOT EXISTS FOR (ch:Chapter) ON (ch.order)',

    // PipelineStatus indexes
    'CREATE INDEX pipeline_project IF NOT EXISTS FOR (ps:PipelineStatus) ON (ps.project_id)',

    // Video indexes
    'CREATE INDEX video_project IF NOT EXISTS FOR (v:Video) ON (v.project_id)',

    // User indexes
    'CREATE INDEX user_email_idx IF NOT EXISTS FOR (u:User) ON (u.email)',
    'CREATE INDEX user_role IF NOT EXISTS FOR (u:User) ON (u.role)',
  ];

  for (const cypher of indexes) {
    try {
      await writeQuery(cypher);
    } catch (err) {
      console.warn(`[schema] Index warning: ${(err as Error).message}`);
    }
  }

  console.log('[schema] Schema initialization complete');
}
