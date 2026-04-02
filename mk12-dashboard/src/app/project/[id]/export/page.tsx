"use client";

import { use, useState } from "react";
import { Download, FileText, FileSpreadsheet, Film, Loader2, AlertTriangle, Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { useDownloadExport } from "@/hooks/use-export";
import { getWebSocketClient } from "@/lib/websocket";
import { apiClient } from "@/lib/api-client";
import type { ExportFormat } from "@/lib/types";

interface FormatOption {
  format: ExportFormat;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  extension: string;
  category: "nle" | "data";
}

const FORMAT_OPTIONS: FormatOption[] = [
  { format: "premiere_xml", label: "Premiere Pro XML", description: "Adobe Premiere Pro project timeline", icon: Film, extension: "xml", category: "nle" },
  { format: "fcpxml", label: "Final Cut Pro XML", description: "Final Cut Pro X project timeline", icon: Film, extension: "fcpxml", category: "nle" },
  { format: "edl", label: "EDL", description: "Edit Decision List — universal NLE format", icon: FileText, extension: "edl", category: "nle" },
  { format: "json", label: "JSON", description: "Full segment and blueprint data", icon: FileText, extension: "json", category: "data" },
  { format: "csv", label: "CSV Spreadsheet", description: "Segment data for spreadsheet analysis", icon: FileSpreadsheet, extension: "csv", category: "data" },
];

export default function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const downloadExport = useDownloadExport(projectId);
  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendingToPlugin, setSendingToPlugin] = useState(false);
  const [pluginSent, setPluginSent] = useState(false);

  // Check if review is complete before allowing Send
  const { data: blueprintData } = useQuery({
    queryKey: ["blueprint", projectId],
    queryFn: () => apiClient.blueprint.get(projectId),
    enabled: !!projectId,
  });
  const reviewStats = blueprintData?.reviewStats;
  const isReviewed = (reviewStats?.reviewed ?? 0) > 0 && reviewStats?.percentComplete === 100;

  const handleExport = async (format: ExportFormat) => {
    setActiveFormat(format);
    setError(null);
    try {
      await downloadExport.mutateAsync(format);
    } catch (err) {
      setError((err as Error).message || "Export failed");
    } finally {
      setActiveFormat(null);
    }
  };

  const handleSendToPlugin = () => {
    setSendingToPlugin(true);
    setError(null);
    try {
      const client = getWebSocketClient();
      client.send("project_update", { action: "timeline_import", projectId });
      setPluginSent(true);
      setTimeout(() => setPluginSent(false), 3000);
    } catch {
      setError("Failed to send to plugin. Is Premiere Pro connected?");
    } finally {
      setSendingToPlugin(false);
    }
  };

  const categories = [
    { key: "nle" as const, label: "NLE Timelines" },
    { key: "data" as const, label: "Data Exports" },
  ];

  return (
    <PageLayout title="Export" description="Download timeline files and project data">
      <div className="mx-auto max-w-3xl space-y-8">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            <AlertTriangle className="size-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Send to Premiere Pro — only visible after review is complete */}
        {isReviewed && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Premiere Pro</h3>
            <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-500/10">
                <Send className="size-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium">Send to Premiere Pro</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Import approved segments directly onto your Premiere Pro timeline
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleSendToPlugin}
                disabled={sendingToPlugin}
                className={pluginSent ? "bg-green-600 hover:bg-green-600" : ""}
              >
                {sendingToPlugin ? <Loader2 className="size-3.5 animate-spin" /> : pluginSent ? "Sent!" : <><Send className="size-3.5" />Send</>}
              </Button>
            </div>
          </div>
        )}

        {categories.map((cat) => (
          <div key={cat.key} className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat.label}</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {FORMAT_OPTIONS.filter((f) => f.category === cat.key).map((opt) => {
                const Icon = opt.icon;
                const isExporting = activeFormat === opt.format;
                return (
                  <div key={opt.format} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Icon className="size-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium">{opt.label}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleExport(opt.format)} disabled={isExporting}>
                      {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}
