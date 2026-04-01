"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ResearchSource {
  title: string;
  url?: string;
  type: "article" | "paper" | "report";
}

export interface ResearchResult {
  id: string;
  concept: string;
  concept_id: string;
  summary: string;
  keyFacts: string[];
  sources: ResearchSource[];
  teachingNotes: string;
  visualSuggestions: string[];
  created_at: string;
  project_id: string;
}

interface ResearchConceptResponse {
  project_id: string;
  research: ResearchResult;
}

interface ResearchListResponse {
  project_id: string;
  count: number;
  results: ResearchResult[];
}

interface BulkResearchResponse {
  project_id: string;
  count: number;
  results: ResearchResult[];
}

// ─── API helpers ─────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const TOKEN_KEY = "mk12_token";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  if (options?.body) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? res.statusText);
  }
  return res.json();
}

// ─── Query keys ──────────────────────────────────────────────────────────────

export const researchKeys = {
  all: (projectId: string) => ["research", projectId] as const,
  list: (projectId: string) => [...researchKeys.all(projectId), "list"] as const,
  concept: (projectId: string, conceptId: string) =>
    [...researchKeys.all(projectId), "concept", conceptId] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Get research for a specific concept.
 */
export function useResearch(projectId: string, conceptId: string | undefined) {
  return useQuery({
    queryKey: researchKeys.concept(projectId, conceptId ?? ""),
    queryFn: () =>
      fetchJson<ResearchConceptResponse>(
        `/api/projects/${projectId}/research/${conceptId}`,
      ).then((r) => r.research),
    enabled: !!projectId && !!conceptId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry on 404
  });
}

/**
 * List all research results for a project.
 */
export function useProjectResearch(projectId: string) {
  return useQuery({
    queryKey: researchKeys.list(projectId),
    queryFn: () =>
      fetchJson<ResearchListResponse>(`/api/projects/${projectId}/research`),
    enabled: !!projectId,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Research a specific concept (mutation).
 */
export function useResearchConcept(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conceptId: string) =>
      fetchJson<ResearchConceptResponse>(
        `/api/projects/${projectId}/research/${conceptId}`,
        { method: "POST" },
      ).then((r) => r.research),
    onSuccess: (data, conceptId) => {
      // Update the individual concept research cache
      queryClient.setQueryData(
        researchKeys.concept(projectId, conceptId),
        data,
      );
      // Invalidate the list to include new research
      queryClient.invalidateQueries({ queryKey: researchKeys.list(projectId) });
    },
  });
}

/**
 * Bulk research all concepts in a project (mutation).
 */
export function useBulkResearch(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchJson<BulkResearchResponse>(
        `/api/projects/${projectId}/research/bulk`,
        { method: "POST" },
      ),
    onSuccess: () => {
      // Invalidate all research queries for this project
      queryClient.invalidateQueries({ queryKey: researchKeys.all(projectId) });
    },
  });
}
