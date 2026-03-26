// ─── User & Roles ────────────────────────────────────────────────────────────

export type UserRole = "admin" | "editor" | "reviewer" | "viewer";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}

// ─── Project ─────────────────────────────────────────────────────────────────

export type ProjectStatus =
  | "uploading"
  | "analyzing"
  | "review"
  | "approved"
  | "exporting"
  | "completed"
  | "error";

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  sourceUrl?: string;
  sourceUrls?: string[];
  duration?: number; // seconds
  thumbnailUrl?: string;
  segmentCount?: number;
  approvedCount?: number;
  tags?: string[];
  owner: User;
  collaborators: User[];
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  brief?: string;
  video_paths?: string[];
  source_urls?: string[];
  fps?: number;
  resolution?: { width: number; height: number };
  tags?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  sourceUrl?: string;
  video_paths?: string[];
  status?: ProjectStatus;
}

// ─── Segments ────────────────────────────────────────────────────────────────

export type SegmentDecision =
  | "keep"
  | "cut"
  | "trim"
  | "rearrange"
  | "speed_up"
  | "review";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "overridden";

export interface AudioMetrics {
  averageLoudness: number;
  peakLoudness: number;
  noiseFloor: number;
  silencePercentage: number;
  speechClarity: number;
}

export interface Segment {
  id: string;
  projectId: string;
  index: number;
  startTime: number; // seconds
  endTime: number; // seconds
  decision: SegmentDecision;
  confidence: number; // 0-100
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: string;
  transcript: string;
  summary?: string;
  explanation: string; // AI decision explanation
  conceptId?: string;
  conceptLabel?: string;
  communityColor?: string;
  chapterId?: string;
  chapterTitle?: string;
  prerequisites?: string[];
  audioMetrics?: AudioMetrics;
  contentMarkId?: string;
  overrideReason?: string;
}

export interface SegmentFilters {
  decision?: SegmentDecision[];
  approvalStatus?: ApprovalStatus[];
  confidenceMin?: number;
  confidenceMax?: number;
  search?: string;
  chapterId?: string;
  conceptId?: string;
}

export interface SegmentOverride {
  decision: SegmentDecision;
  reason: string;
}

// ─── Chapters ────────────────────────────────────────────────────────────────

export interface Chapter {
  id: string;
  projectId: string;
  title: string;
  startTime: number;
  endTime: number;
  segmentIds: string[];
  conceptIds: string[];
  summary?: string;
}

// ─── Content Marks ───────────────────────────────────────────────────────────

export type ContentMarkType =
  | "key_concept"
  | "definition"
  | "example"
  | "transition"
  | "summary"
  | "callout"
  | "visual_aid";

export interface ContentMark {
  id: string;
  projectId: string;
  segmentId: string;
  type: ContentMarkType;
  label: string;
  description?: string;
  timestamp: number;
  duration?: number;
  style?: Record<string, string>;
  approved: boolean;
}

export interface UpdateContentMarkInput {
  label?: string;
  description?: string;
  type?: ContentMarkType;
  style?: Record<string, string>;
  approved?: boolean;
}

// ─── Knowledge Graph ─────────────────────────────────────────────────────────

export interface KnowledgeNode {
  id: string;
  label: string;
  type: "concept" | "topic" | "entity" | "skill";
  community: number;
  communityColor: string;
  importance: number; // 0-1
  segmentIds: string[];
  x?: number;
  y?: number;
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  relationship: string;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

export type PipelineStageName =
  | "transcription"
  | "knowledge_graph"
  | "pedagogical_analysis"
  | "director_decisions"
  | "package_compilation";

export type PipelineStageStatus =
  | "pending"
  | "running"
  | "completed"
  | "error"
  | "skipped";

export interface PipelineStage {
  name: PipelineStageName;
  label: string;
  status: PipelineStageStatus;
  progress: number; // 0-100
  startedAt?: string;
  completedAt?: string;
  duration?: number; // seconds
  error?: string;
}

export interface PipelineStatus {
  projectId: string;
  stages: PipelineStage[];
  overallProgress: number; // 0-100
  currentStage?: PipelineStageName;
  eta?: number; // seconds remaining
  startedAt?: string;
  completedAt?: string;
}

// ─── Transcript ──────────────────────────────────────────────────────────────

export interface TranscriptWord {
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  speaker?: string;
}

export interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  words: TranscriptWord[];
  speaker?: string;
}

export interface TranscriptVersion {
  id: string;
  projectId: string;
  version: number;
  createdAt: string;
  segments: TranscriptSegment[];
  language: string;
  model?: string;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export type ExportFormat =
  | "edit_package_v3"
  | "premiere_xml"
  | "davinci_xml"
  | "fcpx_xml"
  | "srt"
  | "json"
  | "csv";

export interface ExportRequest {
  projectId: string;
  format: ExportFormat;
  includeRejected?: boolean;
}

export interface ExportResult {
  id: string;
  projectId: string;
  format: ExportFormat;
  status: "generating" | "ready" | "error";
  downloadUrl?: string;
  createdAt: string;
  fileSize?: number;
  error?: string;
}

// ─── Edit Package V3 ────────────────────────────────────────────────────────

export interface EditPackageV3 {
  version: 3;
  projectId: string;
  createdAt: string;
  metadata: {
    sourceDuration: number;
    outputDuration: number;
    segmentCount: number;
    approvedCount: number;
  };
  segments: Segment[];
  chapters: Chapter[];
  knowledgeGraph: KnowledgeGraph;
  contentMarks: ContentMark[];
  transcript: TranscriptVersion;
}

// ─── WebSocket Messages ──────────────────────────────────────────────────────

export type WebSocketMessageType =
  | "segment_update"
  | "pipeline_status"
  | "approval_sync"
  | "project_update"
  | "error";

export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType;
  projectId: string;
  payload: T;
  timestamp: string;
}

export interface SegmentUpdatePayload {
  segmentId: string;
  changes: Partial<Segment>;
}

export interface ApprovalSyncPayload {
  segmentId: string;
  approvalStatus: ApprovalStatus;
  approvedBy: string;
}

// ─── SSE Pipeline Events ─────────────────────────────────────────────────────

export interface PipelineSSEEvent {
  type: "stage_start" | "stage_progress" | "stage_complete" | "stage_error" | "pipeline_complete";
  stage?: PipelineStageName;
  progress?: number;
  eta?: number;
  error?: string;
}

// ─── API Response Wrappers ───────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  ok: true;
}

export interface ApiError {
  ok: false;
  error: string;
  code: string;
  status: number;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
