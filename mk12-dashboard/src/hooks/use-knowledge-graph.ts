"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

const knowledgeKeys = {
  graph: (projectId: string) => ["knowledge", projectId, "graph"] as const,
};

export function useKnowledgeGraph(projectId: string) {
  return useQuery({
    queryKey: knowledgeKeys.graph(projectId),
    queryFn: () => apiClient.knowledge.getGraph(projectId),
    enabled: !!projectId,
  });
}

export { knowledgeKeys };
