/**
 * Project CRUD service.
 *
 * Manages project lifecycle with in-memory store (primary) and
 * Neo4j persistence (when available). The in-memory store ensures
 * the backend works without Neo4j for development.
 */

import { v4 as uuid } from 'uuid';
import type { Project, ProjectStatus, EditPackageV3, PipelineStatus } from '../types/index.js';
import { query, writeQuery, isConnected } from '../db/neo4j.js';
import { projectQueries, videoQueries } from '../db/queries.js';

// In-memory project store — primary source of truth
const projects = new Map<string, Project>();

/**
 * List all projects, newest first.
 */
export function listProjects(): Project[] {
  return Array.from(projects.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/**
 * Get a project by ID.
 */
export function getProject(id: string): Project | undefined {
  return projects.get(id);
}

/**
 * Create a new project.
 */
export async function createProject(data: {
  name: string;
  description?: string;
  video_paths?: string[];
  source_urls?: string[];
  brief?: string;
  fps?: number;
  resolution?: { width: number; height: number };
  tags?: string[];
}): Promise<Project> {
  const id = uuid();
  const now = new Date().toISOString();

  const project: Project = {
    id,
    name: data.name,
    status: 'created',
    description: data.description,
    tags: data.tags,
    video_paths: data.video_paths ?? [],
    source_urls: data.source_urls,
    brief: data.brief,
    fps: data.fps,
    resolution: data.resolution,
    created_at: now,
    updated_at: now,
  };

  projects.set(id, project);

  // Persist to Neo4j if available
  if (isConnected()) {
    try {
      const q = projectQueries.create(id, data.name, 'created');
      await writeQuery(q.cypher, q.params);

      // Add video nodes for file paths
      for (const vp of project.video_paths) {
        const vq = videoQueries.addToProject(id, vp, undefined, data.fps);
        await writeQuery(vq.cypher, vq.params);
      }

      // Add video nodes for source URLs
      for (const url of project.source_urls ?? []) {
        const vq = videoQueries.addToProject(id, url, undefined, data.fps);
        await writeQuery(vq.cypher, vq.params);
      }
    } catch (err) {
      console.warn('[project-service] Neo4j persist failed:', (err as Error).message);
    }
  }

  return project;
}

/**
 * Update a project.
 */
export async function updateProject(
  id: string,
  data: Partial<Pick<Project, 'name' | 'status' | 'description' | 'tags' | 'video_paths' | 'source_urls' | 'sourceUrl' | 'brief' | 'fps' | 'resolution'>>
): Promise<Project | undefined> {
  const project = projects.get(id);
  if (!project) return undefined;

  if (data.name !== undefined) project.name = data.name;
  if (data.status !== undefined) project.status = data.status;
  if (data.description !== undefined) project.description = data.description;
  if (data.tags !== undefined) project.tags = data.tags;
  if (data.video_paths !== undefined) project.video_paths = data.video_paths;
  if (data.source_urls !== undefined) project.source_urls = data.source_urls;
  if (data.sourceUrl !== undefined) project.sourceUrl = data.sourceUrl;
  if (data.brief !== undefined) project.brief = data.brief;
  if (data.fps !== undefined) project.fps = data.fps;
  if (data.resolution !== undefined) project.resolution = data.resolution;
  project.updated_at = new Date().toISOString();

  // Sync status to Neo4j
  if (isConnected() && data.status) {
    try {
      const q = projectQueries.updateStatus(id, data.status);
      await writeQuery(q.cypher, q.params);
    } catch (err) {
      console.warn('[project-service] Neo4j update failed:', (err as Error).message);
    }
  }

  return project;
}

/**
 * Delete a project.
 */
export async function deleteProject(id: string): Promise<boolean> {
  const existed = projects.delete(id);

  if (existed && isConnected()) {
    try {
      const q = projectQueries.remove(id);
      await writeQuery(q.cypher, q.params);
    } catch (err) {
      console.warn('[project-service] Neo4j delete failed:', (err as Error).message);
    }
  }

  return existed;
}

/**
 * Attach an edit package to a project.
 */
export function setEditPackage(projectId: string, editPackage: EditPackageV3): boolean {
  const project = projects.get(projectId);
  if (!project) return false;
  project.edit_package = editPackage;
  project.status = 'ready';
  project.updated_at = new Date().toISOString();
  return true;
}

/**
 * Update pipeline status on a project.
 */
export function setPipelineStatus(projectId: string, status: PipelineStatus): boolean {
  const project = projects.get(projectId);
  if (!project) return false;
  project.pipeline_status = status;
  project.updated_at = new Date().toISOString();
  return true;
}

/**
 * Update project status.
 */
export async function setProjectStatus(projectId: string, status: ProjectStatus): Promise<boolean> {
  const project = projects.get(projectId);
  if (!project) return false;
  project.status = status;
  project.updated_at = new Date().toISOString();

  if (isConnected()) {
    try {
      const q = projectQueries.updateStatus(projectId, status);
      await writeQuery(q.cypher, q.params);
    } catch {}
  }

  return true;
}
