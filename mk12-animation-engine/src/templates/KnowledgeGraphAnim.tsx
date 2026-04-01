import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from "remotion";
import { MK12_COLORS, MK12_FONTS, MK12_TYPOGRAPHY } from "../styles/theme";
import { BackgroundGradient, Vignette } from "../components/BackgroundGradient";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  label: string;
  pageRank: number;
  community: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface KnowledgeGraphAnimProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  title: string;
  duration: number; // total frames
}

// ─── Community palette ───────────────────────────────────────────────────────

const COMMUNITY_COLORS = [
  "#0B84F3",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#0ea5e9",
  "#6366f1",
  "#f97316",
  "#14b8a6",
  "#a855f7",
];

function communityColor(community: number): string {
  return COMMUNITY_COLORS[community % COMMUNITY_COLORS.length];
}

// ─── Simple force layout (pre-computed) ──────────────────────────────────────

interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  radius: number;
}

function computeLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
): LayoutNode[] {
  if (nodes.length === 0) return [];

  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) * 0.35;

  // Initialize positions in a circle, offset by community
  const communityAngles = new Map<number, number>();
  let angleStep = (2 * Math.PI) / Math.max(nodes.length, 1);

  const layout: LayoutNode[] = nodes.map((node, i) => {
    // Cluster by community — offset angle based on community
    if (!communityAngles.has(node.community)) {
      communityAngles.set(node.community, communityAngles.size * (Math.PI / 3));
    }
    const baseAngle = communityAngles.get(node.community)!;
    const angle = baseAngle + angleStep * i;
    const dist = maxRadius * (0.4 + 0.6 * (1 - node.pageRank));

    // Node size based on PageRank (min 12, max 40)
    const radius = 12 + node.pageRank * 28;

    return {
      ...node,
      x: centerX + Math.cos(angle) * dist,
      y: centerY + Math.sin(angle) * dist,
      radius,
    };
  });

  // Simple force-directed iterations (lightweight, no D3 dependency)
  const iterations = 50;
  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations;

    // Repulsion between all pairs
    for (let i = 0; i < layout.length; i++) {
      for (let j = i + 1; j < layout.length; j++) {
        const dx = layout[j].x - layout[i].x;
        const dy = layout[j].y - layout[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = layout[i].radius + layout[j].radius + 30;

        if (dist < minDist) {
          const force = ((minDist - dist) / dist) * alpha * 0.5;
          layout[i].x -= dx * force;
          layout[i].y -= dy * force;
          layout[j].x += dx * force;
          layout[j].y += dy * force;
        }
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const a = layout.find((n) => n.id === edge.source);
      const b = layout.find((n) => n.id === edge.target);
      if (!a || !b) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const target = 120;

      if (dist > target) {
        const force = ((dist - target) / dist) * alpha * 0.1;
        a.x += dx * force;
        a.y += dy * force;
        b.x -= dx * force;
        b.y -= dy * force;
      }
    }

    // Pull toward center
    for (const node of layout) {
      node.x += (centerX - node.x) * 0.01 * alpha;
      node.y += (centerY - node.y) * 0.01 * alpha;
    }
  }

  // Clamp to bounds
  const pad = 80;
  for (const node of layout) {
    node.x = Math.max(pad + node.radius, Math.min(width - pad - node.radius, node.x));
    node.y = Math.max(pad + node.radius + 60, Math.min(height - pad - node.radius, node.y));
  }

  return layout;
}

// ─── Edge component ──────────────────────────────────────────────────────────

const AnimatedEdge: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  progress: number;
}> = ({ x1, y1, x2, y2, color, progress }) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const currentLength = length * Math.min(progress, 1);
  const angle = Math.atan2(dy, dx);

  return (
    <div
      style={{
        position: "absolute",
        left: x1,
        top: y1,
        width: currentLength,
        height: 2,
        background: color,
        opacity: interpolate(progress, [0, 0.3, 1], [0, 0.6, 0.4]),
        transform: `rotate(${angle}rad)`,
        transformOrigin: "0 50%",
      }}
    />
  );
};

// ─── Node component ──────────────────────────────────────────────────────────

const AnimatedNode: React.FC<{
  node: LayoutNode;
  progress: number;
  labelProgress: number;
}> = ({ node, progress, labelProgress }) => {
  const scale = interpolate(progress, [0, 1], [0, 1]);
  const color = communityColor(node.community);
  const labelOpacity = interpolate(labelProgress, [0, 1], [0, 1]);

  return (
    <>
      {/* Glow */}
      <div
        style={{
          position: "absolute",
          left: node.x - node.radius * 1.5,
          top: node.y - node.radius * 1.5,
          width: node.radius * 3,
          height: node.radius * 3,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}33 0%, transparent 70%)`,
          transform: `scale(${scale})`,
          opacity: scale * 0.6,
        }}
      />
      {/* Circle */}
      <div
        style={{
          position: "absolute",
          left: node.x - node.radius,
          top: node.y - node.radius,
          width: node.radius * 2,
          height: node.radius * 2,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 35%, ${color}, ${color}88)`,
          border: `2px solid ${color}cc`,
          transform: `scale(${scale})`,
          boxShadow: `0 0 ${node.radius}px ${color}44`,
        }}
      />
      {/* Label */}
      <div
        style={{
          position: "absolute",
          left: node.x,
          top: node.y + node.radius + 6,
          transform: "translateX(-50%)",
          fontFamily: MK12_FONTS.body,
          fontSize: Math.max(11, Math.min(14, 10 + node.pageRank * 6)),
          fontWeight: 600,
          color: MK12_COLORS.foreground,
          textAlign: "center",
          whiteSpace: "nowrap",
          opacity: labelOpacity,
          textShadow: "0 1px 4px rgba(0,0,0,0.8)",
        }}
      >
        {node.label}
      </div>
    </>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const KnowledgeGraphAnim: React.FC<KnowledgeGraphAnimProps> = ({
  nodes,
  edges,
  title,
  duration,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Pre-compute layout once
  const layout = useMemo(
    () => computeLayout(nodes, edges, width, height),
    [nodes, edges, width, height],
  );

  // Title entrance
  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  // Camera pan: slow drift across the graph
  const panX = interpolate(frame, [0, duration], [20, -20], {
    extrapolateRight: "clamp",
  });
  const panY = interpolate(frame, [0, duration], [10, -10], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <BackgroundGradient
        colorA="#0a0a14"
        colorB="#0d1117"
        colorC="#1a1a2e"
        animate
        speed={0.3}
        showGrid
      />

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 30,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: MK12_FONTS.heading,
          ...MK12_TYPOGRAPHY.h3,
          color: MK12_COLORS.foreground,
          opacity: titleProgress,
          transform: `translateY(${interpolate(titleProgress, [0, 1], [20, 0])}px)`,
          zIndex: 10,
          textShadow: "0 2px 8px rgba(0,0,0,0.6)",
        }}
      >
        {title}
      </div>

      {/* Graph container with camera pan */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${panX}px, ${panY}px)`,
        }}
      >
        {/* Edges draw in sequentially */}
        {edges.map((edge, i) => {
          const a = layout.find((n) => n.id === edge.source);
          const b = layout.find((n) => n.id === edge.target);
          if (!a || !b) return null;

          const edgeDelay = 15 + i * 3;
          const edgeProgress = spring({
            frame: Math.max(0, frame - edgeDelay),
            fps,
            config: { damping: 30, stiffness: 60 },
          });

          return (
            <AnimatedEdge
              key={`${edge.source}-${edge.target}-${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              color={communityColor(a.community)}
              progress={edgeProgress}
            />
          );
        })}

        {/* Nodes appear with spring animation */}
        {layout.map((node, i) => {
          const nodeDelay = 5 + i * 4;
          const nodeProgress = spring({
            frame: Math.max(0, frame - nodeDelay),
            fps,
            config: { damping: 15, stiffness: 100, mass: 0.8 },
          });

          const labelDelay = nodeDelay + 10;
          const labelProgress = spring({
            frame: Math.max(0, frame - labelDelay),
            fps,
            config: { damping: 20, stiffness: 60 },
          });

          return (
            <AnimatedNode
              key={node.id}
              node={node}
              progress={nodeProgress}
              labelProgress={labelProgress}
            />
          );
        })}
      </div>

      <Vignette />
    </AbsoluteFill>
  );
};
