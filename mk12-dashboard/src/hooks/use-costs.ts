"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

const costKeys = {
  project: (id: string) => ["costs", id] as const,
  all: ["costs", "all"] as const,
};

export function useProjectCosts(projectId: string) {
  return useQuery({
    queryKey: costKeys.project(projectId),
    queryFn: () => apiClient.costs.getProject(projectId),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useAllProjectCosts() {
  return useQuery({
    queryKey: costKeys.all,
    queryFn: () => apiClient.costs.getAll(),
    staleTime: 30_000,
  });
}
