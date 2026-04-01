import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  Segment,
  SegmentFilters,
  SegmentOverride,
  PipelineStatus,
  TranscriptVersion,
  KnowledgeGraph,
  KnowledgeNode,
  KnowledgeEdge,
  ContentMark,
  UpdateContentMarkInput,
  ExportFormat,
  ExportResult,
  ApiResult,
  PaginatedResponse,
  UploadedVideo,
  UploadResult,
  BlueprintResponse,
  ReviewStats,
  SegmentBlueprint,
  BlueprintMaterial,
  CostSummary,
} from "./types";

// ─── Base fetch wrapper ──────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TOKEN_KEY = "mk12_token";

let _authToken: string | null = null;

/** Set the auth token used by all API requests */
export function setAuthToken(token: string | null) {
  _authToken = token;
}

/** Read the current auth token (from memory or localStorage) */
export function getAuthToken(): string | null {
  if (_authToken) return _authToken;
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      _authToken = stored;
      return stored;
    }
  }
  return null;
}

// Shared with auth.tsx — must stay in sync
export const REFRESH_KEY = "mk12_refresh_token";

/**
 * Attempt to refresh the auth token using the stored refresh token.
 * Updates both in-memory and localStorage tokens on success.
 * Throws if no refresh token is available or the refresh request fails.
 */
export async function refreshAuthToken(): Promise<string> {
  const rt = typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null;
  if (!rt) throw new Error("No refresh token available");
  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: rt }),
  });
  if (!res.ok) throw new Error("Token refresh failed");
  const data = await res.json() as { token: string; refreshToken: string };
  _authToken = data.token;
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
  }
  return data.token;
}

class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  // Only set Content-Type for requests that carry a body
  if (options.body) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText, code: "UNKNOWN" }));
    throw new ApiClientError(res.status, body.code ?? "UNKNOWN", body.error ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── snake_case ↔ camelCase mapping ─────────────────────────────────────────

/**
 * Map backend snake_case project response to dashboard camelCase Project.
 * All snake_case keys from the backend are mapped; leftover snake_case keys
 * are stripped so components never see them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProject(raw: any): Project {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    status: raw.status,
    createdAt: raw.created_at ?? raw.createdAt ?? "",
    updatedAt: raw.updated_at ?? raw.updatedAt ?? "",
    sourceUrls: raw.source_urls ?? raw.sourceUrls,
    videoPaths: raw.video_paths ?? raw.videoPaths ?? [],
    duration: raw.duration,
    fps: raw.fps,
    brief: raw.brief,
    resolution: raw.resolution,
    editPackage: raw.edit_package ?? raw.editPackage,
    pipelineStatus: raw.pipeline_status ?? raw.pipelineStatus,
    thumbnailUrl: raw.thumbnail_url ?? raw.thumbnailUrl,
    settings: raw.settings,
    segmentCount: raw.segment_count ?? raw.segmentCount ?? 0,
    approvedCount: raw.approved_count ?? raw.approvedCount ?? 0,
    tags: raw.tags,
    userId: raw.user_id ?? raw.userId,
    owner: raw.owner,
    collaborators: raw.collaborators,
  };
}

/**
 * Map dashboard camelCase CreateProjectInput to backend snake_case body.
 */
function mapCreateBody(data: CreateProjectInput): Record<string, unknown> {
  return {
    name: data.name,
    description: data.description,
    brief: data.brief,
    video_paths: data.videoPaths,
    source_urls: data.sourceUrls,
    fps: data.fps,
    resolution: data.resolution,
    tags: data.tags,
  };
}

/**
 * Map dashboard camelCase UpdateProjectInput to backend snake_case body.
 */
function mapUpdateBody(data: UpdateProjectInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (data.name !== undefined) body.name = data.name;
  if (data.description !== undefined) body.description = data.description;
  if (data.brief !== undefined) body.brief = data.brief;
  if (data.sourceUrls !== undefined) body.source_urls = data.sourceUrls;
  if (data.videoPaths !== undefined) body.video_paths = data.videoPaths;
  if (data.fps !== undefined) body.fps = data.fps;
  if (data.resolution !== undefined) body.resolution = data.resolution;
  if (data.tags !== undefined) body.tags = data.tags;
  if (data.status !== undefined) body.status = data.status;
  return body;
}

export interface ProjectListParams {
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  limit?: number;
}

export const projects = {
  list: async (params: ProjectListParams = {}): Promise<PaginatedResponse<Project>> => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.status && params.status !== "all") qs.set("status", params.status);
    if (params.sortBy) {
      // Map frontend camelCase sortBy to backend snake_case
      const SORT_MAP: Record<string, string> = { createdAt: "created_at", name: "name", status: "status" };
      qs.set("sortBy", SORT_MAP[params.sortBy] ?? params.sortBy);
    }
    if (params.sortDir) qs.set("sortDir", params.sortDir);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));

    const qsStr = qs.toString();
    const res = await request<{ projects: unknown[]; total: number; page: number; pageSize: number; hasMore: boolean }>(
      `/api/projects${qsStr ? `?${qsStr}` : ""}`,
    );
    const mapped = res.projects.map(mapProject);
    return { data: mapped, total: res.total, page: res.page, pageSize: res.pageSize, hasMore: res.hasMore };
  },

  get: async (id: string): Promise<Project> => {
    const res = await request<{ project: unknown } | Record<string, unknown>>(`/api/projects/${id}`);
    const raw = "project" in res ? res.project : res;
    return mapProject(raw);
  },

  create: async (data: CreateProjectInput): Promise<Project> => {
    const res = await request<{ project: unknown } | Record<string, unknown>>("/api/projects", {
      method: "POST",
      body: JSON.stringify(mapCreateBody(data)),
    });
    const raw = "project" in res ? res.project : res;
    return mapProject(raw);
  },

  update: async (id: string, data: UpdateProjectInput): Promise<Project> => {
    const res = await request<{ project: unknown } | Record<string, unknown>>(`/api/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(mapUpdateBody(data)),
    });
    const raw = "project" in res ? res.project : res;
    return mapProject(raw);
  },

  delete: (id: string): Promise<void> =>
    request(`/api/projects/${id}`, { method: "DELETE" }),

  /**
   * Upload a video file via multipart POST.
   * Uses XMLHttpRequest for progress tracking.
   */
  uploadVideo: (
    projectId: string,
    file: File,
    onProgress?: (percent: number) => void,
  ): { promise: Promise<UploadResult>; abort: () => void } => {
    const xhr = new XMLHttpRequest();
    const promise = new Promise<UploadResult>((resolve, reject) => {
      xhr.open("POST", `${BASE_URL}/api/projects/${projectId}/upload`);

      const token = getAuthToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      if (onProgress) {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
      }

      xhr.addEventListener("load", () => {
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            const body = JSON.parse(xhr.responseText);
            resolve({ uploaded: body.uploaded, projectId: body.project_id });
          } else {
            let message: string;
            try {
              message = JSON.parse(xhr.responseText).error ?? xhr.statusText;
            } catch {
              message = xhr.statusText || `Upload failed with status ${xhr.status}`;
            }
            reject(new ApiClientError(xhr.status, "UPLOAD_ERROR", message));
          }
        } catch {
          reject(new ApiClientError(xhr.status, "PARSE_ERROR", "Failed to parse upload response"));
        }
      });

      xhr.addEventListener("error", () => {
        reject(new ApiClientError(0, "NETWORK_ERROR", "Upload failed — network error"));
      });

      xhr.addEventListener("abort", () => {
        reject(new ApiClientError(0, "ABORT", "Upload aborted"));
      });

      const form = new FormData();
      form.append("file", file);
      xhr.send(form);
    });

    return { promise, abort: () => xhr.abort() };
  },

  /**
   * Upload a video from a URL (backend fetches it).
   */
  uploadVideoFromUrl: (
    projectId: string,
    url: string,
    filename?: string,
  ): Promise<UploadResult> =>
    request(`/api/projects/${projectId}/upload`, {
      method: "POST",
      body: JSON.stringify({ url, filename }),
    }).then((res: any) => ({ uploaded: res.uploaded, projectId: res.project_id })),

  /**
   * List uploaded videos with presigned URLs.
   */
  listVideos: (projectId: string): Promise<{ videos: UploadedVideo[]; warning?: string }> =>
    request(`/api/projects/${projectId}/videos`),

  /**
   * Delete an uploaded video.
   */
  deleteVideo: (projectId: string, key: string): Promise<{ deleted: string }> =>
    request(`/api/projects/${projectId}/videos/${encodeURIComponent(key)}`, {
      method: "DELETE",
    }),
};

// ─── Segments ────────────────────────────────────────────────────────────────

function buildSegmentQuery(filters?: SegmentFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.decision?.length) params.set("decision", filters.decision.join(","));
  if (filters.approvalStatus?.length) params.set("approvalStatus", filters.approvalStatus.join(","));
  if (filters.confidenceMin != null) params.set("confidenceMin", String(filters.confidenceMin));
  if (filters.confidenceMax != null) params.set("confidenceMax", String(filters.confidenceMax));
  if (filters.search) params.set("search", filters.search);
  if (filters.chapterId) params.set("chapterId", filters.chapterId);
  if (filters.conceptId) params.set("conceptId", filters.conceptId);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSegment(raw: any, projectId: string, index: number): Segment {
  return {
    id: raw.id,
    projectId,
    index,
    startTime: raw.start ?? raw.startTime ?? 0,
    endTime: raw.end ?? raw.endTime ?? 0,
    decision: (raw.suggestion ?? raw.decision ?? "review") as Segment["decision"],
    confidence: typeof raw.confidence === "number"
      ? raw.confidence <= 1 ? Math.round(raw.confidence * 100) : raw.confidence
      : 0,
    approvalStatus: raw.approved ? "approved" : raw.rejected ? "rejected" : "pending",
    transcript: raw.transcript ?? "",
    explanation: raw.explanation ?? "",
    summary: raw.summary,
    conceptLabel: raw.concepts?.[0],
    chapterTitle: raw.chapter,
    overrideReason: raw.override_decision ? raw.explanation : undefined,
  };
}

export const segments = {
  list: async (projectId: string, filters?: SegmentFilters): Promise<Segment[]> => {
    const res = await request<{ segments: unknown[] } | unknown[]>(
      `/api/projects/${projectId}/segments${buildSegmentQuery(filters)}`,
    );
    const raw = Array.isArray(res) ? res : (res as { segments: unknown[] }).segments ?? [];
    return raw.map((s, i) => mapSegment(s, projectId, i));
  },

  approve: async (projectId: string, segmentId: string): Promise<Segment> => {
    const raw = await request<unknown>(`/api/projects/${projectId}/segments`, {
      method: "PUT",
      body: JSON.stringify({ segmentId, action: "approve" }),
    });
    return mapSegment(raw, projectId, 0);
  },

  reject: async (projectId: string, segmentId: string, override?: SegmentOverride): Promise<Segment> => {
    const raw = await request<unknown>(`/api/projects/${projectId}/segments`, {
      method: "PUT",
      body: JSON.stringify({ segmentId, action: "reject", override }),
    });
    return mapSegment(raw, projectId, 0);
  },

  bulkApprove: async (projectId: string, segmentIds: string[]): Promise<Segment[]> => {
    const raw = await request<unknown[]>(`/api/projects/${projectId}/segments`, {
      method: "PUT",
      body: JSON.stringify({ segmentIds, action: "bulk_approve" }),
    });
    return (Array.isArray(raw) ? raw : []).map((s, i) => mapSegment(s, projectId, i));
  },
};

// ─── Blueprint mapper ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMaterial(raw: any): BlueprintMaterial | null {
  if (!raw) return null;
  return {
    id: raw.id ?? "",
    type: raw.type ?? "stock_video",
    url: raw.url ?? raw.asset_url ?? "",
    thumbnailUrl: raw.thumbnailUrl ?? raw.thumbnail_url ?? null,
    source: raw.source ?? "",
    provider: raw.provider ?? "",
    width: raw.width,
    height: raw.height,
    duration: raw.duration,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSegmentBlueprint(raw: any): SegmentBlueprint {
  const aiPath = raw.aiPath ?? raw.ai_path ?? {};
  return {
    segmentId: raw.segmentId ?? raw.segment_id ?? "",
    mediaPath: raw.mediaPath ?? raw.media_path ?? "",
    start: raw.start ?? null,
    end: raw.end ?? null,
    text: raw.text ?? "",
    topic: raw.topic ?? "",
    role: raw.role ?? "",
    importance: raw.importance ?? 0,
    suggestion: raw.suggestion ?? "review",
    confidence: raw.confidence ?? 0,
    explanation: raw.explanation ?? "",
    aiPath: {
      action: aiPath.action ?? "keep_original",
      material: mapMaterial(aiPath.material),
      reason: aiPath.reason ?? "",
      trackIndex: aiPath.trackIndex ?? aiPath.track_index ?? 0,
      inPoint: aiPath.inPoint ?? aiPath.in_point ?? null,
      outPoint: aiPath.outPoint ?? aiPath.out_point ?? null,
      transitionBefore: aiPath.transitionBefore ?? aiPath.transition_before ?? null,
      transitionAfter: aiPath.transitionAfter ?? aiPath.transition_after ?? null,
    },
    originalPath: { action: "keep_original" },
    userChoice: raw.userChoice ?? raw.user_choice ?? null,
    reviewUrl: raw.reviewUrl ?? raw.review_url ?? "",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBlueprintResponse(raw: any, projectId: string): BlueprintResponse {
  const bp = raw.blueprint ?? raw;
  const segments = (bp.segments ?? []).map(mapSegmentBlueprint);
  return {
    blueprint: {
      projectId: bp.projectId ?? bp.project_id ?? projectId,
      sessionId: bp.sessionId ?? bp.session_id ?? "",
      segments,
      materials: (bp.materials ?? []).map(mapMaterial).filter(Boolean) as BlueprintMaterial[],
      stats: {
        totalSegments: bp.stats?.totalSegments ?? bp.stats?.total_segments ?? segments.length,
        keepOriginal: bp.stats?.keepOriginal ?? bp.stats?.keep_original ?? 0,
        addOverlay: bp.stats?.addOverlay ?? bp.stats?.add_overlay ?? 0,
        replaceFootage: bp.stats?.replaceFootage ?? bp.stats?.replace_footage ?? 0,
        addText: bp.stats?.addText ?? bp.stats?.add_text ?? 0,
        addAnimation: bp.stats?.addAnimation ?? bp.stats?.add_animation ?? 0,
        cutSegments: bp.stats?.cutSegments ?? bp.stats?.cut_segments ?? 0,
        materialsGenerated: bp.stats?.materialsGenerated ?? bp.stats?.materials_generated ?? 0,
      },
      warnings: bp.warnings ?? [],
      createdAt: bp.createdAt ?? bp.created_at ?? "",
    },
    reviewStats: mapReviewStats(raw.reviewStats ?? raw.review_stats),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReviewStats(raw: any): ReviewStats {
  if (!raw) return { total: 0, reviewed: 0, pending: 0, aiAccepted: 0, originalChosen: 0, custom: 0, percentComplete: 0 };
  return {
    total: raw.total ?? 0,
    reviewed: raw.reviewed ?? 0,
    pending: raw.pending ?? 0,
    aiAccepted: raw.aiAccepted ?? raw.ai_accepted ?? 0,
    originalChosen: raw.originalChosen ?? raw.original_chosen ?? 0,
    custom: raw.custom ?? 0,
    percentComplete: raw.percentComplete ?? raw.percent_complete ?? 0,
  };
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

// Stage labels imported from shared types — single source of truth
import { formatStageName, STAGE_DISPLAY_NAMES } from "./types";

// Map backend snake_case pipeline status to dashboard camelCase
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPipelineStatus(raw: any, projectId: string): PipelineStatus {
  if (!raw) return { projectId, stages: [], overallProgress: 0 };
  return {
    projectId: raw.project_id ?? raw.projectId ?? projectId,
    currentStage: raw.current_stage ?? raw.currentStage,
    overallProgress: raw.overall_progress ?? raw.overallProgress ?? 0,
    eta: raw.eta,
    startedAt: raw.started_at ?? raw.startedAt,
    completedAt: raw.completed_at ?? raw.completedAt,
    stages: (raw.stages ?? []).filter((s: any) => s.name in STAGE_DISPLAY_NAMES).map((s: any) => ({
      name: s.name,
      label: formatStageName(s.name),
      status: s.status,
      progress: s.progress ?? 0,
      startedAt: s.started_at ?? s.startedAt,
      completedAt: s.completed_at ?? s.completedAt,
      duration: s.duration ?? (
        s.completed_at && s.started_at
          ? (new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 1000
          : undefined
      ),
      error: s.error,
    })),
  };
}

export const pipeline = {
  start: async (projectId: string): Promise<PipelineStatus> => {
    const res = await request<{ pipeline_status: unknown }>(`/api/projects/${projectId}/pipeline/start`, { method: "POST", body: JSON.stringify({}) });
    return mapPipelineStatus(res.pipeline_status, projectId);
  },

  status: async (projectId: string): Promise<PipelineStatus> => {
    const res = await request<{ pipeline_status: unknown }>(`/api/projects/${projectId}/pipeline/status`);
    return mapPipelineStatus(res.pipeline_status, projectId);
  },

  stream: (projectId: string): EventSource => {
    const token = getAuthToken();
    const url = token
      ? `${BASE_URL}/api/projects/${projectId}/pipeline/stream?token=${encodeURIComponent(token)}`
      : `${BASE_URL}/api/projects/${projectId}/pipeline/stream`;
    return new EventSource(url);
  },
};

// ─── Transcript ──────────────────────────────────────────────────────────────

// Map backend snake_case transcript to dashboard camelCase
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTranscript(raw: any, projectId: string): TranscriptVersion {
  return {
    id: raw.id ?? "",
    projectId: raw.project_id ?? raw.projectId ?? projectId,
    version: raw.version ?? 1,
    createdAt: raw.created_at ?? raw.createdAt ?? "",
    language: raw.language ?? "unknown",
    model: raw.model,
    segments: (raw.segments ?? []).map((s: any) => ({
      id: s.id ?? "",
      startTime: s.start ?? s.startTime ?? 0,
      endTime: s.end ?? s.endTime ?? 0,
      text: s.text ?? "",
      words: (s.words ?? []).map((w: any) =>
        typeof w === "string" ? { text: w, startTime: 0, endTime: 0, confidence: 1 } : {
          text: w.text ?? w.word ?? "",
          startTime: w.start ?? w.startTime ?? 0,
          endTime: w.end ?? w.endTime ?? 0,
          confidence: w.confidence ?? w.probability ?? 1,
          speaker: w.speaker,
        },
      ),
      speaker: s.speaker,
    })),
  };
}

export const transcript = {
  get: async (projectId: string, version?: number): Promise<TranscriptVersion> => {
    const vq = version != null ? `?version=${version}` : "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await request<any>(`/api/projects/${projectId}/transcript${vq}`);
    // Backend returns { transcript } for single or { transcripts } for list
    const raw = res.transcript ?? (res.transcripts?.[0]) ?? null;
    if (!raw) {
      // Return a minimal empty transcript if nothing found
      return { id: "", projectId, version: 0, createdAt: "", segments: [], language: "unknown" };
    }
    return mapTranscript(raw, projectId);
  },

  export: (projectId: string, format: "srt" | "json" | "txt"): Promise<Blob> => {
    const headers: Record<string, string> = {};
    const token = getAuthToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(`${BASE_URL}/api/projects/${projectId}/transcript?export=${format}`, { headers })
      .then((res) => {
        if (!res.ok) throw new ApiClientError(res.status, "EXPORT_ERROR", "Transcript export failed");
        return res.blob();
      });
  },
};

// ─── Knowledge Graph ─────────────────────────────────────────────────────────

const COMMUNITY_COLORS = [
  "#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#14b8a6", "#f97316",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapKnowledgeGraph(raw: any): KnowledgeGraph {
  const nodes: KnowledgeNode[] = (raw.nodes ?? []).map((n: any) => ({
    id: n.id ?? "",
    label: n.label ?? n.name ?? "",
    type: n.type ?? "topic",
    community: n.community ?? 0,
    communityColor: n.communityColor ?? COMMUNITY_COLORS[(n.community ?? 0) % COMMUNITY_COLORS.length],
    importance: n.importance ?? 0,
    segmentIds: n.segmentIds ?? n.properties?.segments ?? n.segments ?? [],
  }));
  const edges: KnowledgeEdge[] = (raw.edges ?? []).map((e: any, i: number) => ({
    id: e.id ?? `edge-${i}`,
    source: e.source ?? "",
    target: e.target ?? "",
    relationship: e.relationship ?? "RELATES_TO",
    weight: e.weight ?? 1,
  }));
  return { nodes, edges };
}

export const knowledge = {
  getGraph: async (projectId: string): Promise<KnowledgeGraph> => {
    const res = await request<{ graph: any }>(`/api/projects/${projectId}/knowledge`);
    return mapKnowledgeGraph(res.graph);
  },
};

// ─── Content Marks ───────────────────────────────────────────────────────────

export const marks = {
  list: async (projectId: string): Promise<ContentMark[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await request<{ marks: any[] } | any[]>(
      `/api/projects/${projectId}/marks`,
    );
    const raw = Array.isArray(res) ? res : (res.marks ?? []);
    return raw.map((m: any) => ({
      id: m.id ?? m.segment_id ?? "",
      projectId,
      segmentId: m.segment_id ?? m.segmentId ?? "",
      type: m.content_mark?.asset_type ?? m.type ?? "key_concept",
      label: m.content_mark?.search_query ?? m.label ?? m.chapter ?? "",
      description: m.content_mark?.notes ?? m.description ?? "",
      timestamp: m.start ?? m.timestamp ?? 0,
      duration: m.end != null && m.start != null ? m.end - m.start : m.duration,
      style: m.style,
      approved: m.approved ?? false,
    }));
  },

  update: (projectId: string, markId: string, data: UpdateContentMarkInput): Promise<ContentMark> =>
    request(`/api/projects/${projectId}/marks`, {
      method: "PUT",
      body: JSON.stringify({ markId, ...data }),
    }),
};

// ─── Export ──────────────────────────────────────────────────────────────────

export const exports_ = {
  generate: (projectId: string, format: ExportFormat): Promise<ExportResult> =>
    request(`/api/projects/${projectId}/export`, {
      method: "POST",
      body: JSON.stringify({ format }),
    }),

  download: (projectId: string, format: ExportFormat): Promise<Blob> => {
    const headers: Record<string, string> = {};
    const token = getAuthToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(`${BASE_URL}/api/projects/${projectId}/export?format=${format}`, { headers })
      .then((res) => {
        if (!res.ok) throw new ApiClientError(res.status, "DOWNLOAD_ERROR", "Export download failed");
        return res.blob();
      });
  },
};

// ─── Stock Footage ──────────────────────────────────────────────────────────

export const stock = {
  search: (query: string, count: number = 15): Promise<{ query: string; count: number; results: unknown[] }> =>
    request(`/api/stock/search?q=${encodeURIComponent(query)}&count=${count}`),

  suggestions: (projectId: string): Promise<{ project_id: string; suggestions: unknown[] }> =>
    request(`/api/projects/${projectId}/stock-suggestions`),

  generate: (projectId: string): Promise<{ project_id: string; suggestions: unknown[] }> =>
    request(`/api/projects/${projectId}/stock-suggestions/generate`, { method: "POST" }),

  select: (projectId: string, segmentId: string, stockIds: string[]): Promise<unknown> =>
    request(`/api/projects/${projectId}/stock-suggestions/select`, {
      method: "POST",
      body: JSON.stringify({ segment_id: segmentId, stock_ids: stockIds }),
    }),
};

// ─── Templates ──────────────────────────────────────────────────────────────

export const templates = {
  list: (): Promise<{ templates: unknown[]; count: number }> =>
    request("/api/templates"),

  generate: (projectId: string, options?: { template_ids?: string[]; concept_id?: string }): Promise<unknown> =>
    request(`/api/projects/${projectId}/templates/generate`, {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    }),

  status: (projectId: string, jobId?: string): Promise<unknown> => {
    const qs = jobId ? `?job_id=${jobId}` : "";
    return request(`/api/projects/${projectId}/templates/status${qs}`);
  },
};

// ─── AI Image Generation ─────────────────────────────────────────────────────

export const images = {
  list: (projectId: string): Promise<{ project_id: string; count: number; images: unknown[] }> =>
    request(`/api/projects/${projectId}/images`),

  get: (projectId: string, imageId: string): Promise<{ image: unknown }> =>
    request(`/api/projects/${projectId}/images/${imageId}`),

  generate: (projectId: string, data: {
    prompt: string;
    model?: string;
    width?: number;
    height?: number;
    aspectRatio?: string;
  }): Promise<{ image: unknown }> =>
    request(`/api/projects/${projectId}/images/generate`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  generateForSegment: (projectId: string, segmentId: string, data?: {
    model?: string;
    width?: number;
    height?: number;
    aspectRatio?: string;
  }): Promise<{ image: unknown }> =>
    request(`/api/projects/${projectId}/segments/${segmentId}/generate-image`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
};

// ─── Deep Research ───────────────────────────────────────────────────────────

export const research = {
  list: (projectId: string): Promise<{ project_id: string; count: number; results: unknown[] }> =>
    request(`/api/projects/${projectId}/research`),

  get: (projectId: string, conceptId: string): Promise<{ project_id: string; research: unknown }> =>
    request(`/api/projects/${projectId}/research/${conceptId}`),

  research: (projectId: string, conceptId: string): Promise<{ project_id: string; research: unknown }> =>
    request(`/api/projects/${projectId}/research/${conceptId}`, { method: "POST" }),

  bulkResearch: (projectId: string): Promise<{ project_id: string; count: number; results: unknown[] }> =>
    request(`/api/projects/${projectId}/research/bulk`, { method: "POST" }),
};

// ─── Annotations ────────────────────────────────────────────────────────────

export const annotations = {
  list: async (projectId: string): Promise<{ annotations: unknown[]; count: number }> =>
    request(`/api/projects/${projectId}/annotations`),

  create: async (
    projectId: string,
    data: {
      text: string;
      timestamp: number;
      segment_id: string;
      author_id: string;
      author_name: string;
      color?: string;
    },
    collabClientId?: string,
  ): Promise<{ annotation: unknown }> =>
    request(`/api/projects/${projectId}/annotations`, {
      method: "POST",
      headers: collabClientId ? { "X-Collab-Client-Id": collabClientId } : undefined,
      body: JSON.stringify(data),
    }),

  update: async (
    projectId: string,
    annotationId: string,
    data: { text?: string; timestamp?: number },
    collabClientId?: string,
  ): Promise<{ annotation: unknown }> =>
    request(`/api/projects/${projectId}/annotations/${annotationId}`, {
      method: "PUT",
      headers: collabClientId ? { "X-Collab-Client-Id": collabClientId } : undefined,
      body: JSON.stringify(data),
    }),

  delete: async (
    projectId: string,
    annotationId: string,
    collabClientId?: string,
  ): Promise<void> =>
    request(`/api/projects/${projectId}/annotations/${annotationId}`, {
      method: "DELETE",
      headers: collabClientId ? { "X-Collab-Client-Id": collabClientId } : undefined,
    }),
};

// ─── Unified Client ─────────────────────────────────────────────────────────

export const apiClient = {
  projects,
  segments,
  pipeline,
  transcript,
  knowledge,
  marks,
  exports: exports_,
  stock,
  templates,
  images,
  research,
  annotations,
  blueprint: {
    get: async (projectId: string): Promise<BlueprintResponse> => {
      const raw = await request<any>(`/api/projects/${projectId}/blueprint`);
      return mapBlueprintResponse(raw, projectId);
    },
    getSegment: (projectId: string, segId: string) =>
      request<any>(`/api/projects/${projectId}/blueprint/segment/${segId}`),
    updateChoice: async (projectId: string, segId: string, choice: 'ai' | 'original' | 'custom', customNotes?: string): Promise<{ stats?: ReviewStats }> => {
      const res = await request<any>(`/api/projects/${projectId}/blueprint/segment/${segId}`, {
        method: 'PUT',
        body: JSON.stringify({ choice, customNotes }),
      });
      return { stats: res.stats ?? res.reviewStats };
    },
    bulkUpdate: async (projectId: string, segmentIds: string[], choice: 'ai' | 'original'): Promise<{ stats?: ReviewStats }> => {
      const res = await request<any>(`/api/projects/${projectId}/blueprint/bulk`, {
        method: 'PUT',
        body: JSON.stringify({ segmentIds, choice }),
      });
      return { stats: res.stats ?? res.reviewStats };
    },
    regenerate: (projectId: string, segId: string, query?: string) =>
      request<any>(`/api/projects/${projectId}/blueprint/regenerate/${segId}`, {
        method: 'POST',
        body: JSON.stringify({ query }),
      }),
    stats: (projectId: string) =>
      request<any>(`/api/projects/${projectId}/blueprint/stats`),
  },
  costs: {
    getProject: async (projectId: string): Promise<CostSummary> => {
      const res = await request<{ costs: CostSummary }>(`/api/projects/${projectId}/costs`);
      return res.costs;
    },
    getAll: async (): Promise<Record<string, number>> => {
      const res = await request<{ costs: Record<string, number> }>(`/api/costs/summary`);
      return res.costs;
    },
  },
};

export default apiClient;
export { ApiClientError };
