import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { MK12_COLORS } from "../styles/theme";

// ─── Built-in SVG Icons ─────────────────────────────────────────────────────
// Simple, clean SVG icons for common concepts. No external dependencies.

const ICON_PATHS: Record<string, string> = {
  // Finance / Business
  currency:
    "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L10 14v1c0 1.1.9 2 2 2v1.93zM17.9 17.39c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z",
  chart:
    "M3 13h2v8H3v-8zm4-4h2v12H7V9zm4-4h2v16h-2V5zm4 8h2v8h-2v-8zm4-4h2v12h-2V9z",
  document:
    "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z",
  workflow:
    "M4 6h4v4H4V6zm0 8h4v4H4v-4zm8-8h4v4h-4V6zm8 0h4v4h-4V6zm-8 8h4v4h-4v-4zm8 0h4v4h-4v-4z",
  // People / Communication
  person:
    "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  group:
    "M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
  chat:
    "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z",
  // Technology
  code:
    "M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z",
  cloud:
    "M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z",
  // Misc
  lightbulb:
    "M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z",
  checkmark:
    "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z",
  arrow:
    "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z",
  star:
    "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27z",
  clock:
    "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z",
};

interface IconAnimationProps {
  /** Icon key from built-in set */
  icon: keyof typeof ICON_PATHS | string;
  /** Icon size in pixels */
  size?: number;
  /** Icon color */
  color?: string;
  /** Frame at which animation starts */
  startFrame?: number;
  /** Animation type */
  animation?: "scale" | "rotate" | "pulse" | "bounce";
  /** Custom SVG path (overrides icon key) */
  customPath?: string;
}

export const IconAnimation: React.FC<IconAnimationProps> = ({
  icon,
  size = 64,
  color = MK12_COLORS.primary,
  startFrame = 0,
  animation = "scale",
  customPath,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const path = customPath || ICON_PATHS[icon] || ICON_PATHS.lightbulb;

  const entrance = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.6 },
  });

  let transform = "";
  switch (animation) {
    case "scale":
      transform = `scale(${entrance})`;
      break;
    case "rotate": {
      const rotation = interpolate(entrance, [0, 1], [-180, 0]);
      transform = `scale(${entrance}) rotate(${rotation}deg)`;
      break;
    }
    case "pulse": {
      const pulse = 1 + Math.sin((frame - startFrame) * 0.15) * 0.08;
      transform = `scale(${entrance * pulse})`;
      break;
    }
    case "bounce": {
      const bounceY = Math.sin((frame - startFrame) * 0.12) * 6;
      transform = `scale(${entrance}) translateY(${bounceY}px)`;
      break;
    }
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        opacity: entrance,
        transform,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={color}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={path} />
      </svg>
    </div>
  );
};

/** Convenience: list of available icon keys */
export const AVAILABLE_ICONS = Object.keys(ICON_PATHS);
