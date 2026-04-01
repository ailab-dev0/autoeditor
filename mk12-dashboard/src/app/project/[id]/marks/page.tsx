"use client";

import { use, useState } from "react";
import { Loader2, LayoutGrid, Film, Sparkles } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { ContentMarkCard } from "@/components/marks/ContentMarkCard";
import { StockFootageGallery } from "@/components/marks/StockFootageGallery";
import { ImageGenerator, ImageGallery } from "@/components/marks/ImageGenerator";
import { useContentMarks } from "@/hooks/use-content-marks";
import { cn } from "@/lib/utils";

type TabId = "marks" | "stock" | "ai-images";

export default function MarksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const { data: marks, isLoading } = useContentMarks(projectId);
  const [activeTab, setActiveTab] = useState<TabId>("marks");
  const [selectedMarkSegmentId, setSelectedMarkSegmentId] = useState<string | undefined>();

  if (isLoading) {
    return (
      <PageLayout title="Content Marks">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Content Marks"
      description={marks ? `${marks.length} marks identified` : "No marks available"}
    >
      {/* Tab navigation */}
      <div className="mb-4 flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("marks")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            activeTab === "marks"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutGrid className="size-3.5" />
          Marks
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("stock")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            activeTab === "stock"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Film className="size-3.5" />
          Stock Footage
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ai-images")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            activeTab === "ai-images"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Sparkles className="size-3.5" />
          AI Images
        </button>
      </div>

      {/* Content Marks tab */}
      {activeTab === "marks" && (
        <>
          {marks && marks.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {marks.map((mark) => (
                <div key={mark.id} className="space-y-2">
                  <ContentMarkCard
                    mark={mark}
                    onEdit={() => {
                      setSelectedMarkSegmentId(
                        selectedMarkSegmentId === mark.segmentId ? undefined : mark.segmentId,
                      );
                    }}
                  />
                  {/* Inline image generator for ai_image type marks */}
                  {selectedMarkSegmentId === mark.segmentId && (
                    <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
                      <ImageGenerator
                        projectId={projectId}
                        segmentId={mark.segmentId}
                        defaultPrompt={mark.description ?? mark.label}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm text-muted-foreground">
                No content marks yet. Run the pipeline to detect them.
              </p>
            </div>
          )}
        </>
      )}

      {/* Stock Footage tab */}
      {activeTab === "stock" && (
        <StockFootageGallery projectId={projectId} />
      )}

      {/* AI Images tab */}
      {activeTab === "ai-images" && (
        <div className="space-y-6">
          {/* Free-form image generator */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold mb-3">Generate from Prompt</h3>
            <ImageGenerator projectId={projectId} />
          </div>

          {/* Gallery of all generated images */}
          <ImageGallery projectId={projectId} />
        </div>
      )}
    </PageLayout>
  );
}
