"use client";

import { use, useState } from "react";
import { Loader2, Info, BookOpen } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { KnowledgeGraph } from "@/components/graph/KnowledgeGraph";
import { ResearchPanel } from "@/components/graph/ResearchPanel";
import { ConceptTag } from "@/components/shared/ConceptTag";
import { useKnowledgeGraph } from "@/hooks/use-knowledge-graph";
import { cn } from "@/lib/utils";
import type { KnowledgeNode } from "@/lib/types";

export default function KnowledgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const { data: graph, isLoading } = useKnowledgeGraph(projectId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [sidebarTab, setSidebarTab] = useState<"inspector" | "research">("inspector");

  const selectedNode = graph?.nodes?.find((n) => n.id === selectedNodeId);

  if (isLoading) {
    return (
      <PageLayout title="Knowledge Graph">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Knowledge Graph" description="Concept map extracted from video content" fullHeight>
      <div className="flex h-full">
        {/* Graph visualization */}
        <div className="flex-1">
          {graph?.nodes && graph?.edges ? (
            <KnowledgeGraph
              nodes={graph.nodes}
              edges={graph.edges}
              selectedNodeId={selectedNodeId}
              onNodeClick={setSelectedNodeId}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No knowledge graph data. Run the pipeline first.
            </div>
          )}
        </div>

        {/* Right sidebar with tabs */}
        <div className="w-80 border-l border-border flex flex-col">
          {/* Tab bar */}
          <div className="flex border-b border-border shrink-0">
            <button
              onClick={() => setSidebarTab("inspector")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
                sidebarTab === "inspector" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Info className="size-3.5" />Inspector
            </button>
            <button
              onClick={() => setSidebarTab("research")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
                sidebarTab === "research" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BookOpen className="size-3.5" />Research
            </button>
          </div>

          {/* Tab content */}
          {sidebarTab === "inspector" ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedNode ? (
                <NodeDetail node={selectedNode} />
              ) : (
                <p className="text-xs text-muted-foreground">Click a node to inspect</p>
              )}

              {graph?.nodes && graph.nodes.length > 0 && (
                <div className="space-y-2 pt-4 border-t border-border">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Communities</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(
                      new Map(graph.nodes.map((n) => [n.community, n.communityColor])),
                    ).map(([community, color]) => (
                      <span key={community} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                        <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                        Community {community}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ResearchPanel
                projectId={projectId}
                conceptId={selectedNodeId}
                conceptLabel={selectedNode?.label}
              />
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}

function NodeDetail({ node }: { node: KnowledgeNode }) {
  return (
    <div className="space-y-3">
      <div>
        <ConceptTag label={node.label} communityColor={node.communityColor} size="md" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md bg-muted p-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</div>
          <div className="text-sm font-medium capitalize">{node.type}</div>
        </div>
        <div className="rounded-md bg-muted p-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Importance</div>
          <div className="text-sm font-medium tabular-nums">{(node.importance * 100).toFixed(0)}%</div>
        </div>
        <div className="rounded-md bg-muted p-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Community</div>
          <div className="flex items-center gap-1 text-sm">
            <span className="size-2 rounded-full" style={{ backgroundColor: node.communityColor }} />
            {node.community}
          </div>
        </div>
        <div className="rounded-md bg-muted p-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Segments</div>
          <div className="text-sm font-medium tabular-nums">{node.segmentIds.length}</div>
        </div>
      </div>
    </div>
  );
}
