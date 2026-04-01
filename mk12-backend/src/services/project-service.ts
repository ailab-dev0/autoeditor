/**
 * Project CRUD service.
 *
 * Projects are stored in Postgres (Neon) with user_id ownership.
 * All data stored in Postgres. MinIO used for pipeline artifacts.
 * (segments, concepts, knowledge graph).
 */

import type { Project, ProjectStatus, EditPackageV3, PipelineStatus } from '../types/index.js';
import { query as pgQuery } from '../db/postgres.js';

// ── Helper: convert Postgres row to Project ────────────────────

interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: string;
  video_paths: unknown;
  source_urls: unknown;
  pipeline_status: unknown;
  edit_package: unknown;
  settings: Record<string, unknown> | null;
  created_at: string | Date;
  updated_at: string | Date;
}

function rowToProject(row: ProjectRow): Project {
  const settings = row.settings ?? {};
  const videoPaths = Array.isArray(row.video_paths) ? row.video_paths : [];
  const sourceUrls = Array.isArray(row.source_urls) ? row.source_urls : [];
  return {
    id: row.id,
    name: row.name,
    status: (row.status ?? 'created') as Project['status'],
    description: row.description ?? undefined,
    tags: Array.isArray(settings.tags) ? settings.tags : [],
    video_paths: videoPaths,
    source_urls: sourceUrls.length > 0 ? sourceUrls : undefined,
    brief: (settings.brief as string) ?? undefined,
    fps: (settings.fps as number) ?? undefined,
    resolution: (settings.resolution as { width: number; height: number }) ?? undefined,
    created_at: typeof row.created_at === 'string' ? row.created_at : row.created_at?.toISOString?.() ?? String(row.created_at),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : row.updated_at?.toISOString?.() ?? String(row.updated_at),
    edit_package: (row.edit_package as Project['edit_package']) ?? undefined,
    pipeline_status: (row.pipeline_status as Project['pipeline_status']) ?? undefined,
    user_id: row.user_id,
  };
}

// ── Filter options for listing ─────────────────────────────────

export interface ListProjectsOptions {
  search?: string;
  status?: string;
  sortBy?: 'name' | 'status' | 'created_at';
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ListProjectsResult {
  projects: Project[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ── User-scoped CRUD ───────────────────────────────────────────

/**
 * List projects for a user with optional search, filter, sort, and pagination.
 */
export async function listProjects(
  userId: string,
  opts: ListProjectsOptions = {},
): Promise<ListProjectsResult> {
  const {
    search,
    status,
    sortBy = 'created_at',
    sortDir = 'desc',
    page = 1,
    limit: rawLimit = 20,
  } = opts;

  const limit = Math.min(Math.max(rawLimit, 1), 100);
  const offset = (Math.max(page, 1) - 1) * limit;

  // Whitelist sort columns to prevent injection
  const SORT_COLUMNS: Record<string, string> = {
    name: 'name',
    status: 'status',
    created_at: 'created_at',
  };
  const orderCol = SORT_COLUMNS[sortBy] ?? 'created_at';
  const orderDir = sortDir === 'asc' ? 'ASC' : 'DESC';

  // Build WHERE clauses
  const conditions: string[] = ['user_id = $1'];
  const params: unknown[] = [userId];
  let paramIdx = 2;

  if (status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }

  if (search) {
    const escaped = search.replace(/[%_\\]/g, '\\$&');
    conditions.push(`(name ILIKE $${paramIdx} ESCAPE '\\' OR COALESCE(description, '') ILIKE $${paramIdx} ESCAPE '\\')`);
    params.push(`%${escaped}%`);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

  // Count total matching rows
  const countResult = await pgQuery(
    `SELECT COUNT(*)::int AS total FROM projects WHERE ${whereClause}`,
    params,
  );
  const total: number = countResult.rows[0]?.total ?? 0;

  // Fetch page
  const dataResult = await pgQuery(
    `SELECT * FROM projects WHERE ${whereClause} ORDER BY ${orderCol} ${orderDir} LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset],
  );

  const projects = dataResult.rows.map(rowToProject);

  return {
    projects,
    total,
    page: Math.max(page, 1),
    pageSize: limit,
    hasMore: offset + projects.length < total,
  };
}

/**
 * Get a project by ID (verify ownership).
 */
export async function getProject(userId: string, projectId: string): Promise<Project | undefined> {
  const result = await pgQuery(
    'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
    [projectId, userId],
  );
  return result.rows[0] ? rowToProject(result.rows[0]) : undefined;
}

/**
 * Create a new project owned by a user.
 */
export async function createProject(
  userId: string,
  data: {
    name: string;
    description?: string;
    video_paths?: string[];
    source_urls?: string[];
    brief?: string;
    fps?: number;
    resolution?: { width: number; height: number };
    tags?: string[];
  },
): Promise<Project> {
  const settings = {
    ...(data.brief ? { brief: data.brief } : {}),
    ...(data.fps ? { fps: data.fps } : {}),
    ...(data.resolution ? { resolution: data.resolution } : {}),
    ...(data.tags ? { tags: data.tags } : {}),
  };

  const result = await pgQuery(
    `INSERT INTO projects (user_id, name, description, video_paths, source_urls, settings)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      userId,
      data.name,
      data.description || null,
      JSON.stringify(data.video_paths ?? []),
      JSON.stringify(data.source_urls ?? []),
      JSON.stringify(settings),
    ],
  );

  const project = rowToProject(result.rows[0]);

  return project;
}

/**
 * Update a project (verify ownership).
 */
export async function updateProject(
  userId: string,
  projectId: string,
  data: Partial<Pick<Project, 'name' | 'status' | 'description' | 'tags' | 'video_paths' | 'source_urls' | 'brief' | 'fps' | 'resolution'>>,
): Promise<Project | undefined> {
  // Build dynamic SET clause
  const setClauses: string[] = ['updated_at = NOW()'];
  const params: any[] = [projectId, userId];
  let paramIdx = 3;

  if (data.name !== undefined) { setClauses.push(`name = $${paramIdx++}`); params.push(data.name); }
  if (data.status !== undefined) { setClauses.push(`status = $${paramIdx++}`); params.push(data.status); }
  if (data.description !== undefined) { setClauses.push(`description = $${paramIdx++}`); params.push(data.description); }
  if (data.video_paths !== undefined) { setClauses.push(`video_paths = $${paramIdx++}`); params.push(JSON.stringify(data.video_paths)); }
  if (data.source_urls !== undefined) { setClauses.push(`source_urls = $${paramIdx++}`); params.push(JSON.stringify(data.source_urls)); }

  // Store tags, brief, fps, resolution in settings JSONB
  if (data.tags !== undefined || data.brief !== undefined || data.fps !== undefined || data.resolution !== undefined) {
    // Merge into existing settings via jsonb concatenation
    const settingsUpdate: Record<string, unknown> = {};
    if (data.tags !== undefined) settingsUpdate.tags = data.tags;
    if (data.brief !== undefined) settingsUpdate.brief = data.brief;
    if (data.fps !== undefined) settingsUpdate.fps = data.fps;
    if (data.resolution !== undefined) settingsUpdate.resolution = data.resolution;
    setClauses.push(`settings = COALESCE(settings, '{}'::jsonb) || $${paramIdx++}::jsonb`);
    params.push(JSON.stringify(settingsUpdate));
  }

  const result = await pgQuery(
    `UPDATE projects SET ${setClauses.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
    params,
  );

  if (result.rows.length === 0) return undefined;

  const project = rowToProject(result.rows[0]);

  return project;
}

/**
 * Delete a project (verify ownership).
 */
export async function deleteProject(userId: string, projectId: string): Promise<boolean> {
  const result = await pgQuery(
    'DELETE FROM projects WHERE id = $1 AND user_id = $2',
    [projectId, userId],
  );

  const deleted = (result.rowCount ?? 0) > 0;

  if (deleted) {
    // Clean up MinIO project files (best-effort)
    try {
      const { isStorageConfigured, deleteFile } = await import('./storage-service.js');
      if (isStorageConfigured()) {
        const keys = [
          `projects/${projectId}/manifest.json`,
          `projects/${projectId}/pipeline-checkpoint.json`,
          `projects/${projectId}/content-flow-meta.json`,
          `projects/${projectId}/content-flow-segments.jsonl`,
          `projects/${projectId}/blueprint-meta.json`,
          `projects/${projectId}/blueprint-segments.jsonl`,
        ];
        await Promise.allSettled(keys.map(k => deleteFile(k)));
        console.log(`[project-service] Cleaned up MinIO data for project ${projectId}`);
      }
    } catch (err) {
      console.warn('[project-service] MinIO cleanup failed (non-fatal):', (err as Error).message);
    }
  }

  return deleted;
}

// ── System-level accessors (no user filter) ────────────────────
// Used by internal services (pipeline, WebSocket, analysis) that
// don't have a user context.

/**
 * Get a project by ID without user ownership check.
 * For internal/system use only (pipeline, WebSocket handlers, etc.)
 */
export async function getProjectById(projectId: string): Promise<Project | undefined> {
  const result = await pgQuery(
    'SELECT * FROM projects WHERE id = $1',
    [projectId],
  );
  return result.rows[0] ? rowToProject(result.rows[0]) : undefined;
}

/**
 * Attach an edit package to a project.
 */
export async function setEditPackage(projectId: string, editPackage: EditPackageV3): Promise<boolean> {
  const result = await pgQuery(
    `UPDATE projects SET edit_package = $1, status = 'ready', updated_at = NOW() WHERE id = $2 RETURNING id`,
    [JSON.stringify(editPackage), projectId],
  );
  return result.rows.length > 0;
}

/**
 * Update pipeline status on a project.
 */
export async function setPipelineStatus(projectId: string, status: PipelineStatus): Promise<boolean> {
  const result = await pgQuery(
    `UPDATE projects SET pipeline_status = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
    [JSON.stringify(status), projectId],
  );

  return result.rows.length > 0;
}

/**
 * Update project status.
 */
export async function setProjectStatus(projectId: string, status: ProjectStatus): Promise<boolean> {
  const result = await pgQuery(
    `UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
    [status, projectId],
  );
  return result.rows.length > 0;
}
