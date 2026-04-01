"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ContentMark, UpdateContentMarkInput } from "@/lib/types";

const marksKeys = {
  all: (projectId: string) => ["marks", projectId] as const,
  list: (projectId: string) => [...marksKeys.all(projectId), "list"] as const,
};

export function useContentMarks(projectId: string) {
  return useQuery({
    queryKey: marksKeys.list(projectId),
    queryFn: () => apiClient.marks.list(projectId),
    enabled: !!projectId,
  });
}

export function useUpdateContentMark(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ markId, data }: { markId: string; data: UpdateContentMarkInput }) =>
      apiClient.marks.update(projectId, markId, data),
    onMutate: async ({ markId, data }) => {
      const queryKey = marksKeys.list(projectId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ContentMark[]>(queryKey);
      queryClient.setQueryData<ContentMark[]>(queryKey, (old) =>
        old?.map((m) => (m.id === markId ? { ...m, ...data } : m)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(marksKeys.list(projectId), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: marksKeys.all(projectId) });
    },
  });
}

export { marksKeys };
