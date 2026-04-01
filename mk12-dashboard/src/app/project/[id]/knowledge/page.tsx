"use client";

import { use, useState } from "react";
import { Loader2 } from "lucide-react";
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
  const [showResearch, setShowResearch] = useState(true);

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

        {/* Right sidebar: Node inspector + Research panel */}
        <div className="w-80 border-l border-border flex flex-col">
          {/* Node inspector (top section) */}
          <div className="shrink-0 overflow-y-auto p-4 space-y-4 border-b border-border">
            <h3 className="text-sm font-semibold">Node Inspector</h3>
            {selectedNode ? (
              <NodeDetail node={selectedNode} />
            ) : (
              <p className="text-xs text-muted-foreground">Click a node to inspect</p>
            )}

            {/* Legend */}
            {graph?.nodes && graph.nodes.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-border">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Communities
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(
                    new Map(graph.nodes.map((n) => [n.community, n.communityColor])),
                  ).map(([community, color]) => (
                    <span
                      key={community}
                      className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                    >
                      <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                      Community {community}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Research panel (bottom section, expandable) */}
          <div className="flex-1 min-h-0">
            <ResearchPanel
              projectId={projectId}
              conceptId={selectedNodeId}
              conceptLabel={selectedNode?.label}
            />
          </div>
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
