/**
 * Shared types for EditorLens MK-12 Backend.
 *
 * These types match the plugin's ProtocolV3 schema and extend it
 * with backend-specific structures for pipeline, Neo4j, and sync.
 */

// ──────────────────────────────────────────────────────────────────
// Suggestion / Decision enums
// ──────────────────────────────────────────────────────────────────

export const VALID_SUGGESTIONS = [
  'keep', 'cut', 'trim_start', 'trim_end', 'trim_both',
  'rearrange', 'speed_up', 'merge', 'review',
] as const;

export type Suggestion = typeof VALID_SUGGESTIONS[number];

export const VALID_ASSET_TYPES = [
  'stock_video', 'article', 'linkedin_photo', 'animation',
  'ai_image', 'loom_recording', 'speaking_only',
] as const;

export type AssetType = typeof VALID_ASSET_TYPES[number];

export const VALID_TRANSITIONS = [
  'cross_dissolve', 'dip_to_black', 'none',
] as const;

export type Transition = typeof VALID_TRANSITIONS[number];

// ──────────────────────────────────────────────────────────────────
// Content Mark
// ──────────────────────────────────────────────────────────────────

export interface ContentMark {
  asset_type: AssetType;
  search_query?: string;
  research_links?: string[];
  notes?: string;
}

// ──────────────────────────────────────────────────────────────────
// Segment
// ──────────────────────────────────────────────────────────────────

export interface Segment {
  id: string;
  start: number;
  end: number;
  suggestion: Suggestion;
  confidence: number;
  explanation: string;
  chapter?: string;
  transcript?: string;
  concepts?: string[];
  content_mark?: ContentMark;
  transition_after?: Transition;
  handle_before?: number;
  handle_after?: number;
  // Approval state (backend-managed)
  approved?: boolean;
  rejected?: boolean;
  override_decision?: Suggestion;
}

// ──────────────────────────────────────────────────────────────────
// Chapter
// ──────────────────────────────────────────────────────────────────

export interface Chapter {
  name: string;
  order: number;
  target_duration: number;
}

// ──────────────────────────────────────────────────────────────────
// Video
// ──────────────────────────────────────────────────────────────────

export interface Video {
  video_path: string;
  duration?: number;
  fps?: number;
  resolution?: { width: number; height: number };
  segments: Segment[];
}

// ──────────────────────────────────────────────────────────────────
// Edit Package V3
// ──────────────────────────────────────────────────────────────────

export interface EditPackageV3 {
  version: 'v3';
  project_name: string;
  pipeline_session_id: string;
  pedagogy_score: number;
  chapters: Chapter[];
  videos: Video[];
  knowledge_graph?: {
    nodes: KnowledgeNode[];
    edges: KnowledgeEdge[];
  };
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ──────────────────────────────────────────────────────────────────
// Project
// ──────────────────────────────────────────────────────────────────

export type ProjectStatus = 'created' | 'analyzing' | 'ready' | 'review' | 'exporting' | 'error';

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  description?: string;
  tags?: string[];
  video_paths: string[];
  source_urls?: string[];
  brief?: string;
  fps?: number;
  resolution?: { width: number; height: number };
  created_at: string;
  updated_at: string;
  edit_package?: EditPackageV3;
  pipeline_status?: PipelineStatus;
  user_id?: string;
}

// ──────────────────────────────────────────────────────────────────
// Pipeline
// ──────────────────────────────────────────────────────────────────

export const PIPELINE_STAGES = [
  'transcription',
  'knowledge_graph',
  'chapter_validation',
  'director_decisions',
] as const;

export type PipelineStageName = typeof PIPELINE_STAGES[number];

export type StageStatus = 'pending' | 'running' | 'completed' | 'error';

export interface PipelineStage {
  name: PipelineStageName;
  status: StageStatus;
  progress: number;        // 0-100
  message?: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface PipelineStatus {
  session_id: string;
  project_id: string;
  status?: 'running' | 'completed' | 'error';
  current_stage: PipelineStageName;
  overall_progress: number; // 0-100
  stages: PipelineStage[];
  started_at: string;
  completed_at?: string;
  error?: string;
}

// ──────────────────────────────────────────────────────────────────
// Knowledge Graph
// ──────────────────────────────────────────────────────────────────

export interface KnowledgeNode {
  id: string;
  label: string;
  type: 'concept' | 'topic' | 'entity' | 'skill';
  importance: number;      // 0-1, from PageRank
  community?: number;      // Louvain community ID
  properties?: Record<string, unknown>;
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  relationship: string;    // PREREQUISITE_OF, BUILDS_UPON, RELATES_TO, etc.
  weight: number;
}

// ──────────────────────────────────────────────────────────────────
// Transcript
// ──────────────────────────────────────────────────────────────────

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  words?: TranscriptWord[];
  speaker?: string;
}

export interface TranscriptVersion {
  id: string;
  project_id: string;
  video_path: string;
  segments: TranscriptSegment[];
  language: string;
  model: string;
  created_at: string;
}

// ──────────────────────────────────────────────────────────────────
// Export Formats
// ──────────────────────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'edl' | 'fcpxml' | 'premiere_xml' | 'json';

// ──────────────────────────────────────────────────────────────────
// WebSocket Messages
// ──────────────────────────────────────────────────────────────────

export type WSClientMessageType =
  | 'analyze_request'
  | 'segment_update'
  | 'heartbeat';

export type WSServerMessageType =
  | 'analyze_response'
  | 'edit_package'
  | 'segment_update'
  | 'pipeline_status'
  | 'error'
  | 'pong';

export interface WSMessage<T = unknown> {
  type: WSClientMessageType | WSServerMessageType;
  payload?: T;
  timestamp?: number;
}

export interface WSAnalyzeRequest {
  project: {
    id?: string;
    name: string;
    video_paths: string[];
  };
  brief: string;
  timestamp: number;
}

export interface WSSegmentUpdate {
  segmentId: string;
  approved: boolean;
  override?: {
    decision: Suggestion;
    reason?: string;
  } | null;
  timestamp: number;
  source: 'plugin' | 'dashboard';
}

export interface WSPipelineStatus {
  stage: PipelineStageName;
  percentage: number;
  eta?: number;
  message?: string;
}

// ──────────────────────────────────────────────────────────────────
// SSE Event
// ──────────────────────────────────────────────────────────────────

export interface SSEEvent {
  event: string;
  data: Record<string, unknown>;
}

// ──────────────────────────────────────────────────────────────────
// Asset Analysis
// ──────────────────────────────────────────────────────────────────

export interface AssetManifest {
  assets: MediaAsset[];
  brief: string;
  scannedAt: string;
}

export interface MediaAsset {
  name: string;
  path: string;
  type: 'video' | 'audio' | 'image';
  selected: boolean;
  duration?: number;
  dimensions?: { width: number; height: number };
  fps?: number;
  codec?: string;
  sizeBytes?: number;
  keyframes?: KeyframeInfo[];
  silenceRegions?: TimeRegion[];
  waveformSummary?: number[];
  transcriptPath?: string;
}

export interface KeyframeInfo {
  timestamp: number;
  storagePath: string;
  tags?: string[];
  description?: string;
}

export interface TimeRegion {
  start: number;
  end: number;
}

// ──────────────────────────────────────────────────────────────────
// Edit Script (AI-generated timeline assembly)
// ──────────────────────────────────────────────────────────────────

export interface EditScript {
  narrative_structure: string;
  duration_estimate: number;
  total_cuts: number;
  pacing: 'slow' | 'moderate' | 'fast' | 'mixed';
  gaps?: string[];
  tracks: TrackPlacement[];
  transitions: ScriptTransition[];
}

export interface TrackPlacement {
  type: 'video' | 'audio' | 'image';
  asset: string;
  in: number;
  out: number;
  track: string;
  reason: string;
  label?: string;
  source_in?: number;
  source_out?: number;
  effect?: string;
  volume?: number;
}

export interface ScriptTransition {
  at: number;
  type: string;
  duration: number;
}

// ──────────────────────────────────────────────────────────────────
// Connected Client tracking
// ──────────────────────────────────────────────────────────────────

export type ClientType = 'plugin' | 'dashboard';

export interface ConnectedClient {
  id: string;
  type: ClientType;
  projectId: string;
  socket: unknown; // WebSocket instance
  connectedAt: string;
}
