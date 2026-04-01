"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ImageModel = "flux" | "flux-pro" | "stable-diffusion";
export type AspectRatio = "16:9" | "4:3" | "1:1";

export interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  width: number;
  height: number;
  model: string;
  created_at: string;
  segment_id?: string;
  project_id: string;
}

export interface GenerateImageInput {
  prompt: string;
  model?: ImageModel;
  width?: number;
  height?: number;
  aspectRatio?: AspectRatio;
}

export interface GenerateForSegmentInput {
  segmentId: string;
  model?: ImageModel;
  width?: number;
  height?: number;
  aspectRatio?: AspectRatio;
}

interface GenerateImageResponse {
  image: GeneratedImage;
}

interface ListImagesResponse {
  project_id: string;
  count: number;
  images: GeneratedImage[];
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

export const imageKeys = {
  all: (projectId: string) => ["images", projectId] as const,
  list: (projectId: string) => [...imageKeys.all(projectId), "list"] as const,
  detail: (projectId: string, imageId: string) =>
    [...imageKeys.all(projectId), "detail", imageId] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * List all generated images for a project.
 */
export function useProjectImages(projectId: string) {
  return useQuery({
    queryKey: imageKeys.list(projectId),
    queryFn: () => fetchJson<ListImagesResponse>(`/api/projects/${projectId}/images`),
    enabled: !!projectId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

/**
 * Generate an image from a text prompt.
 */
export function useGenerateImage(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GenerateImageInput) =>
      fetchJson<GenerateImageResponse>(`/api/projects/${projectId}/images/generate`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imageKeys.list(projectId) });
    },
  });
}

/**
 * Generate an image from a segment's content mark.
 */
export function useGenerateForSegment(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ segmentId, ...options }: GenerateForSegmentInput) =>
      fetchJson<GenerateImageResponse>(
        `/api/projects/${projectId}/segments/${segmentId}/generate-image`,
        {
          method: "POST",
          body: JSON.stringify(options),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imageKeys.list(projectId) });
    },
  });
}
