"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StockResult {
  id: string;
  provider: "pexels" | "pixabay";
  thumbnailUrl: string;
  previewUrl: string;
  downloadUrl: string;
  duration?: number;
  width: number;
  height: number;
  description: string;
  tags: string[];
}

export interface StockSuggestion {
  segment_id: string;
  asset_type: string;
  search_query: string;
  results: StockResult[];
}

interface StockSearchResponse {
  query: string;
  count: number;
  results: StockResult[];
}

interface StockSuggestionsResponse {
  project_id: string;
  generated_at?: string;
  suggestions: StockSuggestion[];
  message?: string;
}

interface StockSelectResponse {
  project_id: string;
  segment_id: string;
  selected_stock_ids: string[];
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
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? res.statusText);
  }
  return res.json();
}

// ─── Query keys ──────────────────────────────────────────────────────────────

export const stockKeys = {
  all: ["stock"] as const,
  search: (query: string) => [...stockKeys.all, "search", query] as const,
  suggestions: (projectId: string) =>
    [...stockKeys.all, "suggestions", projectId] as const,
  selected: (projectId: string) =>
    [...stockKeys.all, "selected", projectId] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Search stock footage across providers.
 */
export function useStockSearch(query: string, count: number = 15) {
  return useQuery({
    queryKey: stockKeys.search(query),
    queryFn: () =>
      fetchJson<StockSearchResponse>(
        `/api/stock/search?q=${encodeURIComponent(query)}&count=${count}`,
      ),
    enabled: query.trim().length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get stock footage suggestions for all content marks in a project.
 */
export function useStockSuggestions(projectId: string) {
  return useQuery({
    queryKey: stockKeys.suggestions(projectId),
    queryFn: () =>
      fetchJson<StockSuggestionsResponse>(
        `/api/projects/${projectId}/stock-suggestions`,
      ),
    enabled: !!projectId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Mutation to select stock footage for a segment.
 */
export function useSelectStock(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      segmentId,
      stockIds,
    }: {
      segmentId: string;
      stockIds: string[];
    }) =>
      fetchJson<StockSelectResponse>(
        `/api/projects/${projectId}/stock-suggestions/select`,
        {
          method: "POST",
          body: JSON.stringify({
            segment_id: segmentId,
            stock_ids: stockIds,
          }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: stockKeys.selected(projectId),
      });
    },
  });
}

/**
 * Trigger AI-enhanced stock search generation.
 */
export function useGenerateStockSuggestions(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchJson<StockSuggestionsResponse>(
        `/api/projects/${projectId}/stock-suggestions/generate`,
        { method: "POST" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: stockKeys.suggestions(projectId),
      });
    },
  });
}
