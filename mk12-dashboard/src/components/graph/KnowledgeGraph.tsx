"use client";

import { useRef, useEffect, useCallback } from "react";
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

    // Simple force-directed layout using requestAnimationFrame
    // For production, integrate d3-force properly
    const nodePositions = new Map<string, { x: number; y: number; vx: number; vy: number }>();

    // Initialize positions
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      const radius = Math.min(width, height) * 0.35;
      nodePositions.set(node.id, {
        x: node.x ?? width / 2 + radius * Math.cos(angle),
        y: node.y ?? height / 2 + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
      });
    });

    // Build edge index
    const edgeIndex = new Map<string, Set<string>>();
    edges.forEach((edge) => {
      if (!edgeIndex.has(edge.source)) edgeIndex.set(edge.source, new Set());
      if (!edgeIndex.has(edge.target)) edgeIndex.set(edge.target, new Set());
      edgeIndex.get(edge.source)!.add(edge.target);
      edgeIndex.get(edge.target)!.add(edge.source);
    });

    // Simple simulation (runs for a fixed number of iterations)
    const iterations = 50;
    for (let iter = 0; iter < iterations; iter++) {
      const alpha = 1 - iter / iterations;

      // Repulsion between all nodes
      const nodeArray = Array.from(nodePositions.entries());
      for (let i = 0; i < nodeArray.length; i++) {
        for (let j = i + 1; j < nodeArray.length; j++) {
          const [, a] = nodeArray[i];
          const [, b] = nodeArray[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = (200 * alpha) / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      // Attraction along edges
      edges.forEach((edge) => {
        const source = nodePositions.get(edge.source);
        const target = nodePositions.get(edge.target);
        if (!source || !target) return;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = (dist - 100) * 0.01 * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      });

      // Center gravity
      nodeArray.forEach(([, pos]) => {
        pos.vx += (width / 2 - pos.x) * 0.001 * alpha;
        pos.vy += (height / 2 - pos.y) * 0.001 * alpha;
      });

      // Apply velocities with damping
      nodeArray.forEach(([, pos]) => {
        pos.x += pos.vx * 0.5;
        pos.y += pos.vy * 0.5;
        pos.vx *= 0.9;
        pos.vy *= 0.9;
        // Clamp to viewport
        pos.x = Math.max(30, Math.min(width - 30, pos.x));
        pos.y = Math.max(30, Math.min(height - 30, pos.y));
      });
    }

    // Render
    renderGraph(svg, nodes, edges, nodePositions, selectedNodeId, onNodeClick);
  }, [nodes, edges, selectedNodeId, onNodeClick]);

  return (
    <div ref={containerRef} className={cn("relative w-full h-full min-h-[400px]", className)}>
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ background: "transparent" }}
      />
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
  // Clear
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const ns = "http://www.w3.org/2000/svg";

  // Edges
  edges.forEach((edge) => {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) return;

    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", String(source.x));
    line.setAttribute("y1", String(source.y));
    line.setAttribute("x2", String(target.x));
    line.setAttribute("y2", String(target.y));
    line.setAttribute("stroke", "#333");
    line.setAttribute("stroke-width", String(Math.max(0.5, edge.weight * 2)));
    line.setAttribute("stroke-opacity", "0.4");
    svg.appendChild(line);
  });

  // Nodes
  nodes.forEach((node) => {
    const pos = positions.get(node.id);
    if (!pos) return;

    const isSelected = node.id === selectedNodeId;
    const radius = 6 + node.importance * 14;

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

    // Label
    if (node.importance > 0.3 || isSelected) {
      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", String(pos.x));
      text.setAttribute("y", String(pos.y + radius + 14));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "#ccc");
      text.setAttribute("font-size", "11");
      text.setAttribute("font-family", "Inter, sans-serif");
      text.textContent = node.label;
      g.appendChild(text);
    }

    svg.appendChild(g);
  });
}
