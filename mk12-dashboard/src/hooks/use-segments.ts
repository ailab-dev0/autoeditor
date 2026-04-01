"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import type { Segment, SegmentFilters, SegmentOverride } from "@/lib/types";
import { useWebSocketSubscribe } from "./use-websocket";

const segmentKeys = {
  all: (projectId: string) => ["segments", projectId] as const,
  list: (projectId: string, filters?: SegmentFilters) =>
    [...segmentKeys.all(projectId), "list", filters ?? {}] as const,
};

export function useSegments(projectId: string, filters?: SegmentFilters) {
  const queryClient = useQueryClient();
  const { subscribe } = useWebSocketSubscribe();

  // Real-time sync: update cache when segment updates arrive via WebSocket
  useEffect(() => {
    if (!projectId) return;
    const unsub = subscribe("segment_update", (payload) => {
      const update = payload as { segmentId: string; changes: Partial<Segment> };
      queryClient.setQueryData<Segment[]>(
        segmentKeys.list(projectId, filters),
        (old) =>
          old?.map((seg) =>
            seg.id === update.segmentId ? { ...seg, ...update.changes } : seg,
          ),
      );
    });
    return unsub;
  }, [projectId, filters, queryClient, subscribe]);

  // Real-time sync: approval changes from other users
  useEffect(() => {
    if (!projectId) return;
    const unsub = subscribe("approval_sync", (payload) => {
      const sync = payload as { segmentId: string; approvalStatus: string; approvedBy: string };
      queryClient.setQueryData<Segment[]>(
        segmentKeys.list(projectId, filters),
        (old) =>
          old?.map((seg) =>
            seg.id === sync.segmentId
              ? {
                  ...seg,
                  approvalStatus: sync.approvalStatus as Segment["approvalStatus"],
                  approvedBy: sync.approvedBy,
                  approvedAt: new Date().toISOString(),
                }
              : seg,
          ),
      );
    });
    return unsub;
  }, [projectId, filters, queryClient, subscribe]);

  return useQuery({
    queryKey: segmentKeys.list(projectId, filters),
    queryFn: () => apiClient.segments.list(projectId, filters),
    enabled: !!projectId,
  });
}

export function useApproveSegment(projectId: string, filters?: SegmentFilters) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (segmentId: string) => apiClient.segments.approve(projectId, segmentId),
    onMutate: async (segmentId) => {
      const queryKey = segmentKeys.list(projectId, filters);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Segment[]>(queryKey);
      queryClient.setQueryData<Segment[]>(queryKey, (old) =>
        old?.map((seg) =>
          seg.id === segmentId
            ? { ...seg, approvalStatus: "approved" as const, approvedAt: new Date().toISOString() }
            : seg,
        ),
      );
      return { previous };
    },
    onError: (_err, _segmentId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(segmentKeys.list(projectId, filters), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: segmentKeys.all(projectId) });
    },
  });
}

export function useRejectSegment(projectId: string, filters?: SegmentFilters) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ segmentId, override }: { segmentId: string; override?: SegmentOverride }) =>
      apiClient.segments.reject(projectId, segmentId, override),
    onMutate: async ({ segmentId }) => {
      const queryKey = segmentKeys.list(projectId, filters);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Segment[]>(queryKey);
      queryClient.setQueryData<Segment[]>(queryKey, (old) =>
        old?.map((seg) =>
          seg.id === segmentId
            ? { ...seg, approvalStatus: "rejected" as const }
            : seg,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(segmentKeys.list(projectId, filters), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: segmentKeys.all(projectId) });
    },
  });
}

export function useBulkApprove(projectId: string, filters?: SegmentFilters) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (segmentIds: string[]) =>
      apiClient.segments.bulkApprove(projectId, segmentIds),
    onMutate: async (segmentIds) => {
      const queryKey = segmentKeys.list(projectId, filters);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Segment[]>(queryKey);
      const idSet = new Set(segmentIds);
      queryClient.setQueryData<Segment[]>(queryKey, (old) =>
        old?.map((seg) =>
          idSet.has(seg.id)
            ? { ...seg, approvalStatus: "approved" as const, approvedAt: new Date().toISOString() }
            : seg,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(segmentKeys.list(projectId, filters), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: segmentKeys.all(projectId) });
    },
  });
}

export { segmentKeys };
