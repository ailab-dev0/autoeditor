import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { MK12_COLORS, MK12_FONTS, MK12_TYPOGRAPHY, MK12_SPACING } from "../styles/theme";
import { BackgroundGradient, Vignette } from "../components/BackgroundGradient";
import { IconAnimation } from "../components/IconAnimation";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FlowStep {
  label: string;
  description: string;
  icon?: string;
}

export interface ProcessFlowProps {
  steps: FlowStep[];
  title: string;
  direction: "horizontal" | "vertical";
  accentColor?: string;
}

// ─── Step colors (cycle through palette) ─────────────────────────────────────

const STEP_COLORS = [
  "#0B84F3",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#0ea5e9",
  "#f97316",
  "#14b8a6",
];

function stepColor(index: number): string {
  return STEP_COLORS[index % STEP_COLORS.length];
}

// ─── Arrow SVG ───────────────────────────────────────────────────────────────

const Arrow: React.FC<{
  direction: "right" | "down";
  progress: number;
  color: string;
}> = ({ direction, progress, color }) => {
  const opacity = interpolate(progress, [0, 1], [0, 0.6]);
  const scale = interpolate(progress, [0, 1], [0.3, 1]);

  if (direction === "right") {
    return (
      <svg
        width={40}
        height={24}
        viewBox="0 0 40 24"
        style={{
          opacity,
          transform: `scaleX(${scale})`,
          flexShrink: 0,
        }}
      >
        <line x1={0} y1={12} x2={30} y2={12} stroke={color} strokeWidth={2} />
        <polygon points="28,6 40,12 28,18" fill={color} />
      </svg>
    );
  }

  return (
    <svg
      width={24}
      height={40}
      viewBox="0 0 24 40"
      style={{
        opacity,
        transform: `scaleY(${scale})`,
        flexShrink: 0,
        alignSelf: "center",
      }}
    >
      <line x1={12} y1={0} x2={12} y2={30} stroke={color} strokeWidth={2} />
      <polygon points="6,28 12,40 18,28" fill={color} />
    </svg>
  );
};

// ─── Step Card ───────────────────────────────────────────────────────────────

const StepCard: React.FC<{
  step: FlowStep;
  index: number;
  total: number;
  progress: number;
  isActive: boolean;
  direction: "horizontal" | "vertical";
}> = ({ step, index, total, progress, isActive, direction }) => {
  const color = stepColor(index);
  const scale = interpolate(progress, [0, 1], [0.7, 1]);
  const opacity = interpolate(progress, [0, 1], [0, 1]);

  const isHorizontal = direction === "horizontal";
  const cardWidth = isHorizontal
    ? Math.min(240, 1600 / total)
    : 500;
  const cardHeight = isHorizontal ? 160 : 80;

  return (
    <div
      style={{
        width: cardWidth,
        minHeight: cardHeight,
        padding: MK12_SPACING.md,
        background: isActive
          ? `linear-gradient(135deg, ${color}22, ${color}11)`
          : MK12_COLORS.card,
        border: `1.5px solid ${isActive ? color : MK12_COLORS.borderDim}`,
        borderRadius: 12,
        transform: `scale(${scale})`,
        opacity,
        display: "flex",
        flexDirection: isHorizontal ? "column" : "row",
        alignItems: isHorizontal ? "center" : "center",
        gap: isHorizontal ? 8 : 16,
        boxShadow: isActive
          ? `0 0 20px ${color}22, 0 4px 12px rgba(0,0,0,0.3)`
          : "0 2px 8px rgba(0,0,0,0.2)",
        flexShrink: 0,
      }}
    >
      {/* Step number badge */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${color}, ${color}88)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: MK12_FONTS.mono,
          fontSize: 16,
          fontWeight: 700,
          color: "#fff",
          flexShrink: 0,
          boxShadow: `0 0 12px ${color}44`,
        }}
      >
        {index + 1}
      </div>

      {/* Icon if present */}
      {step.icon && (
        <div style={{ flexShrink: 0 }}>
          <IconAnimation
            icon={step.icon}
            size={isHorizontal ? 28 : 24}
            color={color}
          />
        </div>
      )}

      {/* Text */}
      <div
        style={{
          textAlign: isHorizontal ? "center" : "left",
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            fontFamily: MK12_FONTS.heading,
            fontSize: isHorizontal ? 15 : 18,
            fontWeight: 600,
            color: MK12_COLORS.foreground,
            lineHeight: 1.3,
          }}
        >
          {step.label}
        </div>
        {step.description && (
          <div
            style={{
              fontFamily: MK12_FONTS.body,
              fontSize: isHorizontal ? 11 : 13,
              color: MK12_COLORS.mutedForeground,
              marginTop: 3,
              lineHeight: 1.4,
            }}
          >
            {step.description}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const ProcessFlow: React.FC<ProcessFlowProps> = ({
  steps,
  title,
  direction,
  accentColor = MK12_COLORS.primary,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Title animation
  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  // Calculate which step is "active" based on frame
  const stepsPerSegment = Math.max(1, Math.floor((durationInFrames - 30) / steps.length));
  const activeIndex = Math.min(
    Math.floor(Math.max(0, frame - 20) / stepsPerSegment),
    steps.length - 1,
  );

  const isHorizontal = direction === "horizontal";

  return (
    <AbsoluteFill>
      <BackgroundGradient
        colorA="#0a0a14"
        colorB="#111122"
        showGrid
      />

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: isHorizontal ? 50 : 40,
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

      {/* Subtitle: step counter */}
      <div
        style={{
          position: "absolute",
          top: isHorizontal ? 100 : 90,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: MK12_FONTS.body,
          fontSize: 14,
          fontWeight: 500,
          color: MK12_COLORS.mutedForeground,
          opacity: titleProgress,
          letterSpacing: 1,
          textTransform: "uppercase",
        }}
      >
        {steps.length} steps
      </div>

      {/* Flow container */}
      <div
        style={{
          position: "absolute",
          top: isHorizontal ? 150 : 130,
          left: isHorizontal ? 40 : 0,
          right: isHorizontal ? 40 : 0,
          bottom: isHorizontal ? 60 : 40,
          display: "flex",
          flexDirection: isHorizontal ? "row" : "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
          overflowY: isHorizontal ? "visible" : "auto",
          overflowX: isHorizontal ? "auto" : "visible",
          padding: isHorizontal ? "0" : "0 200px",
        }}
      >
        {steps.map((step, i) => {
          const stepDelay = 10 + i * 12;
          const stepProgress = spring({
            frame: Math.max(0, frame - stepDelay),
            fps,
            config: { damping: 15, stiffness: 80 },
          });

          const arrowDelay = stepDelay + 6;
          const arrowProgress = spring({
            frame: Math.max(0, frame - arrowDelay),
            fps,
            config: { damping: 20, stiffness: 60 },
          });

          const isActive = i <= activeIndex;
          const isLast = i === steps.length - 1;

          return (
            <React.Fragment key={`step-${i}`}>
              <StepCard
                step={step}
                index={i}
                total={steps.length}
                progress={stepProgress}
                isActive={isActive}
                direction={direction}
              />
              {!isLast && (
                <Arrow
                  direction={isHorizontal ? "right" : "down"}
                  progress={arrowProgress}
                  color={stepColor(i)}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Progress indicator at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 80,
          right: 80,
          height: 3,
          background: MK12_COLORS.border,
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${((activeIndex + 1) / steps.length) * 100}%`,
            background: `linear-gradient(90deg, ${accentColor}, ${stepColor(activeIndex)})`,
            borderRadius: 2,
            transition: "width 0.3s ease",
            boxShadow: `0 0 8px ${accentColor}44`,
          }}
        />
      </div>

      <Vignette />
    </AbsoluteFill>
  );
};
