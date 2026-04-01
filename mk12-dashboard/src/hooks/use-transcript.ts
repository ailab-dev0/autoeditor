"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

const transcriptKeys = {
  all: (projectId: string) => ["transcript", projectId] as const,
  version: (projectId: string, version?: number) =>
    [...transcriptKeys.all(projectId), version ?? "latest"] as const,
};

export function useTranscript(projectId: string, version?: number) {
  return useQuery({
    queryKey: transcriptKeys.version(projectId, version),
    queryFn: () => apiClient.transcript.get(projectId, version),
    enabled: !!projectId,
  });
}

export { transcriptKeys };
