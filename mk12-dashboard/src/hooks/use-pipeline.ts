"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { getAuthToken, refreshAuthToken } from "@/lib/api-client";
import type { PipelineStatus, PipelineSSEEvent, PipelineStage } from "@/lib/types";

const pipelineKeys = {
  status: (projectId: string) => ["pipeline", projectId, "status"] as const,
};

export type SseStatus =
  | "idle"
  | "connected"
  | "reconnecting"
  | "polling"
  | "auth_error";

const MAX_SSE_RECONNECT = 3;
const SSE_BACKOFF_BASE = 2000; // 2s, 4s, 8s
const SSE_BACKOFF_MAX = 30000;

export function usePipeline(projectId: string) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(true);
  const [sseStatus, setSseStatus] = useState<SseStatus>("idle");

  const isPollFallback = sseStatus === "polling" || sseStatus === "auth_error";

  // Initial status fetch + polling fallback when SSE is unavailable
  const query = useQuery({
    queryKey: pipelineKeys.status(projectId),
    queryFn: () => apiClient.pipeline.status(projectId),
    enabled: !!projectId,
    refetchInterval:
      sseStatus === "connected" ? false : isPollFallback ? 5000 : false,
  });

  // Connect SSE with token-aware reconnect
  const connectSSE = useCallback(() => {
    if (!projectId) return;

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const token = getAuthToken();
    if (!token) {
      setSseStatus("auth_error");
      return;
    }

    const es = apiClient.pipeline.stream(projectId);
    eventSourceRef.current = es;

    es.onopen = () => {
      setSseStatus("connected");
      reconnectAttemptsRef.current = 0;
      // Catch up on any missed events with a one-time poll
      queryClient.invalidateQueries({
        queryKey: pipelineKeys.status(projectId),
      });
    };

    es.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data);

        // Initial status push — replace the full pipeline status
        if (raw.type === "initial_status" && raw.status) {
          queryClient.invalidateQueries({
            queryKey: pipelineKeys.status(projectId),
          });
          return;
        }

        const sseEvent = raw as PipelineSSEEvent;

        queryClient.setQueryData<PipelineStatus>(
          pipelineKeys.status(projectId),
          (old) => {
            if (!old) return old;
            return applySSEUpdate(old, sseEvent);
          },
        );

        if (sseEvent.type === "pipeline_complete") {
          es.close();
          eventSourceRef.current = null;
          setSseStatus("idle");
          queryClient.invalidateQueries({
            queryKey: pipelineKeys.status(projectId),
          });
        }
      } catch {
        console.error("[Pipeline SSE] Failed to parse event");
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      scheduleSSEReconnect();
    };
  }, [projectId, queryClient]);

  // Reconnect with exponential backoff + token refresh
  const scheduleSSEReconnect = useCallback(async () => {
    const attempt = reconnectAttemptsRef.current;

    if (attempt >= MAX_SSE_RECONNECT) {
      console.warn(
        "[Pipeline SSE] Max reconnect attempts reached — falling back to polling",
      );
      setSseStatus("polling");
      return;
    }

    setSseStatus("reconnecting");
    reconnectAttemptsRef.current = attempt + 1;

    // Check if token needs refresh before reconnecting
    const token = getAuthToken();
    if (!token || isTokenExpiringSoon(token)) {
      try {
        await refreshAuthToken();
      } catch {
        console.error(
          "[Pipeline SSE] Token refresh failed — session may be expired",
        );
        setSseStatus("auth_error");
        return;
      }
    }

    const delay = Math.min(
      SSE_BACKOFF_BASE * Math.pow(2, attempt),
      SSE_BACKOFF_MAX,
    );
    console.warn(
      `[Pipeline SSE] Reconnecting in ${delay}ms (attempt ${attempt + 1}/${MAX_SSE_RECONNECT})`,
    );

    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current) connectSSE();
    }, delay);
  }, [connectSSE]);

  // SSE lifecycle — connect when pipeline is running
  useEffect(() => {
    if (!projectId) return;

    const currentStatus = query.data;
    const isRunning = currentStatus?.stages?.some(
      (s) => s.status === "running",
    );

    if (!isRunning && !currentStatus?.currentStage) {
      // Pipeline not running — no SSE needed
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (sseStatus === "connected" || sseStatus === "reconnecting") {
        setSseStatus("idle");
      }
      return;
    }

    // Pipeline is running — connect SSE if not already
    if (!eventSourceRef.current && sseStatus !== "auth_error") {
      reconnectAttemptsRef.current = 0;
      connectSSE();
    }

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [projectId, query.data?.currentStage, connectSSE, sseStatus]);

  return {
    ...query,
    sseStatus,
    stages: query.data?.stages ?? [],
    overallProgress: query.data?.overallProgress ?? 0,
    currentStage: query.data?.currentStage,
    eta: query.data?.eta,
  };
}

export function useStartPipeline(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.pipeline.start(projectId),
    onSuccess: (data) => {
      queryClient.setQueryData(pipelineKeys.status(projectId), data);
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isTokenExpiringSoon(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.exp) return false;
    // Token is "expiring soon" if less than 30s remain
    return payload.exp * 1000 - Date.now() < 30_000;
  } catch {
    return true; // Treat parse failure as expired
  }
}

function applySSEUpdate(
  status: PipelineStatus,
  event: PipelineSSEEvent,
): PipelineStatus {
  const updated = { ...status, stages: [...status.stages] };

  switch (event.type) {
    case "stage_start": {
      updated.currentStage = event.stage;
      updated.stages = updated.stages.map((s) =>
        s.name === event.stage
          ? {
              ...s,
              status: "running" as const,
              startedAt: new Date().toISOString(),
              progress: 0,
            }
          : s,
      );
      break;
    }
    case "stage_progress": {
      updated.stages = updated.stages.map((s) =>
        s.name === event.stage
          ? { ...s, progress: event.progress ?? s.progress }
          : s,
      );
      if (event.eta != null) updated.eta = event.eta;
      if (event.progress != null && event.stage) {
        updated.overallProgress = computeOverallProgress(updated.stages);
      }
      break;
    }
    case "stage_complete": {
      updated.stages = updated.stages.map((s) =>
        s.name === event.stage
          ? {
              ...s,
              status: "completed" as const,
              progress: 100,
              completedAt: new Date().toISOString(),
              duration: s.startedAt
                ? (Date.now() - new Date(s.startedAt).getTime()) / 1000
                : undefined,
            }
          : s,
      );
      updated.overallProgress = computeOverallProgress(updated.stages);
      break;
    }
    case "stage_error": {
      updated.stages = updated.stages.map((s) =>
        s.name === event.stage
          ? { ...s, status: "error" as const, error: event.error }
          : s,
      );
      break;
    }
    case "pipeline_complete": {
      updated.currentStage = undefined;
      updated.overallProgress = 100;
      updated.completedAt = new Date().toISOString();
      break;
    }
  }

  return updated;
}

function computeOverallProgress(stages: PipelineStage[]): number {
  if (stages.length === 0) return 0;
  const totalWeight = stages.length;
  const completedWeight = stages.reduce((sum, s) => {
    if (s.status === "completed") return sum + 1;
    if (s.status === "running") return sum + s.progress / 100;
    return sum;
  }, 0);
  return Math.round((completedWeight / totalWeight) * 100);
}

export { pipelineKeys };
