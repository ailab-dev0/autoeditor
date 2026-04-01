"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type { ExportFormat } from "@/lib/types";

export function useGenerateExport(projectId: string) {
  return useMutation({
    mutationFn: (format: ExportFormat) => apiClient.exports.generate(projectId, format),
  });
}

export function useDownloadExport(projectId: string) {
  return useMutation({
    mutationFn: async (format: ExportFormat) => {
      const blob = await apiClient.exports.download(projectId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectId}.${formatExtension(format)}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });
}

function formatExtension(format: ExportFormat): string {
  switch (format) {
    case "premiere_xml":
      return "xml";
    case "fcpxml":
      return "fcpxml";
    case "edl":
      return "edl";
    case "json":
      return "json";
    case "csv":
      return "csv";
  }
}
