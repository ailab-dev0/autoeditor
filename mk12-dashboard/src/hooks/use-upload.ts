"use client";

import { useRef } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { projectKeys } from "@/hooks/use-project";
import type { UploadedVideo, UploadResult } from "@/lib/types";

const uploadKeys = {
  all: ["uploads"] as const,
  videos: (projectId: string) => [...uploadKeys.all, "videos", projectId] as const,
};

/**
 * Fetch the list of uploaded videos (with presigned URLs) for a project.
 */
export function useProjectVideos(projectId: string) {
  return useQuery({
    queryKey: uploadKeys.videos(projectId),
    queryFn: () => apiClient.projects.listVideos(projectId),
    enabled: !!projectId,
    // Presigned URLs expire, so refetch periodically
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Upload a video file with progress tracking.
 * Returns the mutation plus a `getAbort(key)` / `setAbort(key, fn)` / `removeAbort(key)` interface
 * so callers can cancel in-flight uploads.
 */
export function useUploadVideo(projectId: string) {
  const queryClient = useQueryClient();
  // Map of upload key -> abort function, managed by the caller
  const abortMap = useRef<Map<string, () => void>>(new Map());

  const mutation = useMutation({
    mutationFn: ({
      file,
      onProgress,
      uploadKey,
    }: {
      file: File;
      onProgress?: (percent: number) => void;
      uploadKey?: string;
    }) => {
      const { promise, abort } = apiClient.projects.uploadVideo(projectId, file, onProgress);
      if (uploadKey) {
        abortMap.current.set(uploadKey, abort);
      }
      return promise;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: uploadKeys.videos(projectId) });
      // Also refresh the project since video_paths changes
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });

  return Object.assign(mutation, {
    abortMap: abortMap.current,
    abortAll: () => {
      abortMap.current.forEach((abort) => abort());
      abortMap.current.clear();
    },
    removeAbort: (key: string) => {
      abortMap.current.delete(key);
    },
  });
}

/**
 * Upload a video from a URL (backend-side fetch).
 */
export function useUploadVideoFromUrl(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ url, filename }: { url: string; filename?: string }) =>
      apiClient.projects.uploadVideoFromUrl(projectId, url, filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: uploadKeys.videos(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

/**
 * Delete an uploaded video.
 */
export function useDeleteVideo(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (key: string) => apiClient.projects.deleteVideo(projectId, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: uploadKeys.videos(projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

export { uploadKeys };
