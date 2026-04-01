import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { MK12_COLORS, MK12_FONTS } from "../styles/theme";

interface ProgressBarProps {
  /** Target percentage (0-100) */
  percentage: number;
  /** Label shown above the bar */
  label?: string;
  /** Color of the filled portion */
  barColor?: string;
  /** Secondary gradient color (creates gradient with barColor) */
  barColorEnd?: string;
  /** Background track color */
  trackColor?: string;
  /** Width of the bar in pixels */
  width?: number;
  /** Height of the bar in pixels */
  height?: number;
  /** Frame at which animation starts */
  startFrame?: number;
  /** Show percentage text */
  showPercentage?: boolean;
  /** Border radius */
  borderRadius?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  label,
  barColor = MK12_COLORS.primary,
  barColorEnd,
  trackColor = MK12_COLORS.secondary,
  width = 600,
  height = 20,
  startFrame = 0,
  showPercentage = true,
  borderRadius = 10,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const entranceProgress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 18, stiffness: 100, mass: 1 },
    durationInFrames: 20,
  });

  const fillProgress = interpolate(
    frame - startFrame,
    [10, Math.min(durationInFrames * 0.7, 90)],
    [0, percentage],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const barBackground = barColorEnd
    ? `linear-gradient(90deg, ${barColor}, ${barColorEnd})`
    : barColor;

  return (
    <div
      style={{
        width,
        opacity: entranceProgress,
        transform: `translateY(${interpolate(entranceProgress, [0, 1], [15, 0])}px)`,
      }}
    >
      {(label || showPercentage) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 10,
          }}
        >
          {label && (
            <span
              style={{
                color: MK12_COLORS.foreground,
                fontSize: 18,
                fontWeight: 500,
                fontFamily: MK12_FONTS.body,
              }}
            >
              {label}
            </span>
          )}
          {showPercentage && (
            <span
              style={{
                color: barColor,
                fontSize: 20,
                fontWeight: 700,
                fontFamily: MK12_FONTS.mono,
              }}
            >
              {Math.round(fillProgress)}%
            </span>
          )}
        </div>
      )}
      <div
        style={{
          width: "100%",
          height,
          backgroundColor: trackColor,
          borderRadius,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${fillProgress}%`,
            height: "100%",
            background: barBackground,
            borderRadius,
          }}
        />
      </div>
    </div>
  );
};

// ─── Multi-bar variant for comparing multiple values ────────────────────────

interface MultiBarItem {
  label: string;
  value: number;
  color: string;
}

interface MultiProgressBarProps {
  items: MultiBarItem[];
  startFrame?: number;
  staggerDelay?: number;
  width?: number;
  barHeight?: number;
}

export const MultiProgressBar: React.FC<MultiProgressBarProps> = ({
  items,
  startFrame = 0,
  staggerDelay = 8,
  width = 700,
  barHeight = 16,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const maxValue = Math.max(...items.map((i) => i.value), 1);

  return (
    <div style={{ width, display: "flex", flexDirection: "column", gap: 16 }}>
      {items.map((item, idx) => {
        const delay = startFrame + idx * staggerDelay;
        const entrance = spring({
          frame: frame - delay,
          fps,
          config: { damping: 16, stiffness: 140, mass: 0.8 },
        });

        const fillWidth = interpolate(
          entrance,
          [0, 1],
          [0, (item.value / maxValue) * 100],
        );

        return (
          <div key={idx} style={{ opacity: entrance }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  color: MK12_COLORS.foreground,
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: MK12_FONTS.body,
                }}
              >
                {item.label}
              </span>
              <span
                style={{
                  color: item.color,
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: MK12_FONTS.mono,
                }}
              >
                {Math.round(interpolate(entrance, [0, 1], [0, item.value]))}%
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: barHeight,
                backgroundColor: MK12_COLORS.secondary,
                borderRadius: barHeight / 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${fillWidth}%`,
                  height: "100%",
                  backgroundColor: item.color,
                  borderRadius: barHeight / 2,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
