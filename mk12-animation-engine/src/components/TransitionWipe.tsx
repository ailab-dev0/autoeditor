import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { MK12_COLORS } from "../styles/theme";

type WipeDirection = "left" | "right" | "up" | "down";

interface TransitionWipeProps {
  /** Frame at which the wipe begins */
  startFrame: number;
  /** Duration of the wipe in frames */
  durationFrames?: number;
  /** Direction of the wipe */
  direction?: WipeDirection;
  /** Wipe bar color */
  color?: string;
  /** Width of the leading bar edge */
  barWidth?: number;
}

export const TransitionWipe: React.FC<TransitionWipeProps> = ({
  startFrame,
  durationFrames = 15,
  direction = "right",
  color = MK12_COLORS.primary,
  barWidth = 8,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 20, stiffness: 100, mass: 1 },
    durationInFrames: durationFrames,
  });

  if (frame < startFrame || progress <= 0) return null;

  const isHorizontal = direction === "left" || direction === "right";

  const getClipPath = (): string => {
    const p = progress * 100;
    switch (direction) {
      case "right":
        return `inset(0 ${100 - p}% 0 0)`;
      case "left":
        return `inset(0 0 0 ${100 - p}%)`;
      case "down":
        return `inset(0 0 ${100 - p}% 0)`;
      case "up":
        return `inset(${100 - p}% 0 0 0)`;
    }
  };

  const getBarPosition = (): React.CSSProperties => {
    const offset = `${progress * 100}%`;
    switch (direction) {
      case "right":
        return {
          left: offset,
          top: 0,
          width: barWidth,
          height: "100%",
          transform: "translateX(-50%)",
        };
      case "left":
        return {
          right: offset,
          top: 0,
          width: barWidth,
          height: "100%",
          transform: "translateX(50%)",
        };
      case "down":
        return {
          top: offset,
          left: 0,
          height: barWidth,
          width: "100%",
          transform: "translateY(-50%)",
        };
      case "up":
        return {
          bottom: offset,
          left: 0,
          height: barWidth,
          width: "100%",
          transform: "translateY(50%)",
        };
    }
  };

  return (
    <>
      {/* Fill region */}
      <AbsoluteFill
        style={{
          backgroundColor: color,
          clipPath: getClipPath(),
          opacity: interpolate(progress, [0.8, 1], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
      {/* Leading bar */}
      {progress < 1 && (
        <div
          style={{
            position: "absolute",
            backgroundColor: "#ffffff",
            boxShadow: `0 0 20px ${color}, 0 0 40px ${color}`,
            ...getBarPosition(),
          }}
        />
      )}
    </>
  );
};

// ─── Circle reveal transition ───────────────────────────────────────────────

interface CircleRevealProps {
  startFrame: number;
  durationFrames?: number;
  originX?: number;
  originY?: number;
  color?: string;
}

export const CircleReveal: React.FC<CircleRevealProps> = ({
  startFrame,
  durationFrames = 20,
  originX = 50,
  originY = 50,
  color = MK12_COLORS.background,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 16, stiffness: 80, mass: 1.2 },
    durationInFrames: durationFrames,
  });

  if (frame < startFrame || progress <= 0) return null;

  // Max radius needs to cover the diagonal
  const radius = progress * 150;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: color,
        clipPath: `circle(${radius}% at ${originX}% ${originY}%)`,
      }}
    />
  );
};
