"use client";

import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { KnowledgeNode, KnowledgeEdge } from "@/lib/types";

interface KnowledgeGraphProps {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  selectedNodeId?: string;
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

export function KnowledgeGraph({
  nodes,
  edges,
  selectedNodeId,
  onNodeClick,
  className,
}: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    const svg = svgRef.current;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    // Build adjacency for tree layout
    const children = new Map<string, string[]>();
    const hasParent = new Set<string>();
    edges.forEach((e) => {
      if (!children.has(e.source)) children.set(e.source, []);
      children.get(e.source)!.push(e.target);
      hasParent.add(e.target);
    });

    // Find roots (nodes with no incoming edges) — sorted by importance
    const sorted = [...nodes].sort((a, b) => b.importance - a.importance);
    const roots = sorted.filter(n => !hasParent.has(n.id));
    if (roots.length === 0) roots.push(sorted[0]); // fallback

    // Tree layout — assign positions level by level
    const positions = new Map<string, { x: number; y: number }>();
    const visited = new Set<string>();
    const levelWidth = 160;
    const nodeSpacing = 60;

    let globalY = 40;

    function layoutSubtree(nodeId: string, depth: number) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const x = 80 + depth * levelWidth;
      const y = globalY;
      positions.set(nodeId, { x, y });
      globalY += nodeSpacing;

      const kids = children.get(nodeId) || [];
      for (const kid of kids) {
        layoutSubtree(kid, depth + 1);
      }
    }

    for (const root of roots) {
      layoutSubtree(root.id, 0);
    }

    // Layout orphan nodes (no edges)
    for (const node of sorted) {
      if (!visited.has(node.id)) {
        positions.set(node.id, { x: 80, y: globalY });
        globalY += nodeSpacing;
      }
    }

    // Scale to fit viewport
    const maxX = Math.max(...Array.from(positions.values()).map(p => p.x)) + 80;
    const maxY = Math.max(...Array.from(positions.values()).map(p => p.y)) + 40;
    const scaleX = maxX > width ? width / maxX : 1;
    const scaleY = maxY > height ? height / maxY : 1;
    const scale = Math.min(scaleX, scaleY, 1);

    for (const [id, pos] of positions) {
      pos.x = pos.x * scale + (width - maxX * scale) / 2;
      pos.y = pos.y * scale + 20;
    }

    renderGraph(svg, nodes, edges, positions, selectedNodeId, onNodeClick);
  }, [nodes, edges, selectedNodeId, onNodeClick]);

  return (
    <div ref={containerRef} className={cn("relative w-full h-full min-h-[400px]", className)}>
      <svg ref={svgRef} className="w-full h-full" style={{ background: "transparent" }} />
    </div>
  );
}

function renderGraph(
  svg: SVGSVGElement,
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[],
  positions: Map<string, { x: number; y: number }>,
  selectedNodeId?: string,
  onNodeClick?: (id: string) => void,
) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const ns = "http://www.w3.org/2000/svg";

  // Edges as curved paths (tree branches)
  edges.forEach((edge) => {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) return;

    const midX = (source.x + target.x) / 2;
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", `M ${source.x} ${source.y} C ${midX} ${source.y}, ${midX} ${target.y}, ${target.x} ${target.y}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#444");
    path.setAttribute("stroke-width", String(Math.max(0.5, edge.weight)));
    path.setAttribute("stroke-opacity", "0.5");
    svg.appendChild(path);
  });

  // Label collision avoidance — track occupied label regions
  const labelRects: Array<{ x: number; y: number; w: number; h: number }> = [];

  function findLabelY(x: number, baseY: number, labelW: number): number {
    const h = 14;
    let y = baseY;
    for (let attempt = 0; attempt < 5; attempt++) {
      const overlap = labelRects.some(r =>
        x - labelW / 2 < r.x + r.w && x + labelW / 2 > r.x &&
        y - h < r.y + r.h && y + h > r.y
      );
      if (!overlap) break;
      y += 16; // shift down
    }
    labelRects.push({ x: x - labelW / 2, y: y - h, w: labelW, h: h * 2 });
    return y;
  }

  // Nodes
  nodes.forEach((node) => {
    const pos = positions.get(node.id);
    if (!pos) return;

    const isSelected = node.id === selectedNodeId;
    const radius = 5 + node.importance * 12;

    const g = document.createElementNS(ns, "g");
    g.style.cursor = "pointer";
    g.addEventListener("click", () => onNodeClick?.(node.id));

    // Circle
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", String(pos.x));
    circle.setAttribute("cy", String(pos.y));
    circle.setAttribute("r", String(radius));
    circle.setAttribute("fill", node.communityColor);
    circle.setAttribute("fill-opacity", isSelected ? "1" : "0.7");
    circle.setAttribute("stroke", isSelected ? "#fff" : node.communityColor);
    circle.setAttribute("stroke-width", isSelected ? "2" : "1");
    g.appendChild(circle);

    // Label — truncate long names, avoid overlaps
    const maxLabelLen = 25;
    const label = node.label.length > maxLabelLen ? node.label.slice(0, maxLabelLen) + "…" : node.label;
    const estimatedWidth = label.length * 6;
    const labelY = findLabelY(pos.x, pos.y + radius + 14, estimatedWidth);

    const text = document.createElementNS(ns, "text");
    text.setAttribute("x", String(pos.x));
    text.setAttribute("y", String(labelY));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", isSelected ? "#fff" : "#aaa");
    text.setAttribute("font-size", "10");
    text.setAttribute("font-family", "Inter, system-ui, sans-serif");
    text.textContent = label;
    g.appendChild(text);

    svg.appendChild(g);
  });
}
