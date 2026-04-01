/**
 * Annotation Service — CRUD for collaborative annotations.
 *
 * Stored in-memory per project. Annotations are session-scoped
 * collaboration data — they persist while the server is running
 * and are broadcast to connected WebSocket clients.
 */

import { v4 as uuid } from 'uuid';
import { broadcastAnnotationEvent } from '../ws/collaboration.js';

// ─── Types ──────────────────────────────────────────────────────────

export interface Annotation {
  id: string;
  text: string;
  timestamp: number;
  segment_id: string;
  project_id: string;
  author_id: string;
  author_name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAnnotationInput {
  text: string;
  timestamp: number;
  segment_id: string;
  author_id: string;
  author_name: string;
  color?: string;
}

export interface UpdateAnnotationInput {
  text?: string;
  timestamp?: number;
}

// ─── In-memory store ────────────────────────────────────────────────

const store = new Map<string, Annotation[]>(); // projectId → annotations

function getProjectAnnotations(projectId: string): Annotation[] {
  if (!store.has(projectId)) store.set(projectId, []);
  return store.get(projectId)!;
}

// ─── List ───────────────────────────────────────────────────────────

export async function listAnnotations(projectId: string): Promise<Annotation[]> {
  return getProjectAnnotations(projectId);
}

// ─── Get by ID ──────────────────────────────────────────────────────

export async function getAnnotation(projectId: string, annotationId: string): Promise<Annotation | null> {
  return getProjectAnnotations(projectId).find(a => a.id === annotationId) ?? null;
}

// ─── Create ─────────────────────────────────────────────────────────

export async function createAnnotation(projectId: string, input: CreateAnnotationInput): Promise<Annotation> {
  const now = new Date().toISOString();
  const annotation: Annotation = {
    id: uuid(),
    text: input.text,
    timestamp: input.timestamp,
    segment_id: input.segment_id,
    project_id: projectId,
    author_id: input.author_id,
    author_name: input.author_name,
    color: input.color ?? '#FFD700',
    created_at: now,
    updated_at: now,
  };

  getProjectAnnotations(projectId).push(annotation);

  broadcastAnnotationEvent(projectId, 'annotation:created', annotation);

  return annotation;
}

// ─── Update ─────────────────────────────────────────────────────────

export async function updateAnnotation(
  projectId: string,
  annotationId: string,
  input: UpdateAnnotationInput,
): Promise<Annotation | null> {
  const annotations = getProjectAnnotations(projectId);
  const idx = annotations.findIndex(a => a.id === annotationId);
  if (idx === -1) return null;

  const annotation = annotations[idx];
  if (input.text !== undefined) annotation.text = input.text;
  if (input.timestamp !== undefined) annotation.timestamp = input.timestamp;
  annotation.updated_at = new Date().toISOString();

  broadcastAnnotationEvent(projectId, 'annotation:updated', annotation);

  return annotation;
}

// ─── Delete ─────────────────────────────────────────────────────────

export async function deleteAnnotation(projectId: string, annotationId: string): Promise<boolean> {
  const annotations = getProjectAnnotations(projectId);
  const idx = annotations.findIndex(a => a.id === annotationId);
  if (idx === -1) return false;

  const [removed] = annotations.splice(idx, 1);

  broadcastAnnotationEvent(projectId, 'annotation:deleted', removed);

  return true;
}
