import React from "react";
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
import { IconAnimation } from "../components/IconAnimation";
import { ProgressBar } from "../components/ProgressBar";

// ─── InfoGraphic Props ──────────────────────────────────────────────────────
// Used for data visualization, workflow diagrams, and VAT-type explanations.

export interface InfoGraphicStep {
  label: string;
  value?: number;        // percentage or numeric value
  description?: string;
  icon?: string;         // icon key
  color?: string;
}

export interface InfoGraphicProps {
  title: string;
  subtitle?: string;
  steps: InfoGraphicStep[];
  /** "flow" draws connected nodes; "bars" draws horizontal bars; "cards" draws stacked cards */
  layout?: "flow" | "bars" | "cards";
  accentColor?: string;
  gradientStart?: string;
  gradientEnd?: string;
}

export const InfoGraphic: React.FC<InfoGraphicProps> = ({
  title,
  subtitle,
  steps,
  layout = "flow",
  accentColor = MK12_COLORS.primary,
  gradientStart = "#0a0a14",
  gradientEnd = "#1a1a2e",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Title entrance
  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
    durationInFrames: 25,
  });

  // Subtitle entrance (delayed)
  const subtitleProgress = spring({
    frame: frame - 12,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
    durationInFrames: 20,
  });

  // Exit animation
  const exitStart = durationInFrames - 20;
  const exitProgress =
    frame > exitStart
      ? interpolate(frame, [exitStart, durationInFrames], [1, 0], {
          extrapolateRight: "clamp",
        })
      : 1;

  return (
    <BackgroundGradient
      colorA={gradientStart}
      colorB={gradientEnd}
      animate={true}
      speed={0.2}
      showGrid={true}
      showNoise={true}
    >
      <AbsoluteFill
        style={{
          padding: 80,
          opacity: exitProgress,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header Section */}
        <div style={{ marginBottom: 40 }}>
          {/* Accent line */}
          <div
            style={{
              width: interpolate(titleProgress, [0, 1], [0, 80]),
              height: 4,
              backgroundColor: accentColor,
              borderRadius: 2,
              marginBottom: 20,
            }}
          />

          {/* Title */}
          <div
            style={{
              ...MK12_TYPOGRAPHY.h1,
              fontFamily: MK12_FONTS.heading,
              color: MK12_COLORS.foreground,
              opacity: titleProgress,
              transform: `translateY(${interpolate(titleProgress, [0, 1], [20, 0])}px)`,
            }}
          >
            {title}
          </div>

          {/* Subtitle */}
          {subtitle && (
            <div
              style={{
                ...MK12_TYPOGRAPHY.bodyLarge,
                fontFamily: MK12_FONTS.body,
                color: MK12_COLORS.mutedForeground,
                opacity: subtitleProgress,
                transform: `translateY(${interpolate(subtitleProgress, [0, 1], [15, 0])}px)`,
                marginTop: 12,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          {layout === "flow" && (
            <FlowLayout
              steps={steps}
              accentColor={accentColor}
              frame={frame}
              fps={fps}
            />
          )}
          {layout === "bars" && (
            <BarsLayout
              steps={steps}
              accentColor={accentColor}
              frame={frame}
              fps={fps}
            />
          )}
          {layout === "cards" && (
            <CardsLayout
              steps={steps}
              accentColor={accentColor}
              frame={frame}
              fps={fps}
            />
          )}
        </div>
      </AbsoluteFill>
      <Vignette intensity={0.4} />
    </BackgroundGradient>
  );
};

// ─── Flow Layout (connected nodes) ──────────────────────────────────────────

const FlowLayout: React.FC<{
  steps: InfoGraphicStep[];
  accentColor: string;
  frame: number;
  fps: number;
}> = ({ steps, accentColor, frame, fps }) => {
  const stepWidth = Math.min(280, (1920 - 160) / steps.length - 20);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        gap: 0,
      }}
    >
      {steps.map((step, idx) => {
        const delay = 25 + idx * 12;
        const entrance = spring({
          frame: frame - delay,
          fps,
          config: { damping: 14, stiffness: 160, mass: 0.7 },
        });

        const stepColor = step.color || accentColor;

        // Connector line between nodes
        const connectorDelay = delay + 6;
        const connectorProgress = spring({
          frame: frame - connectorDelay,
          fps,
          config: { damping: 20, stiffness: 100 },
        });

        return (
          <React.Fragment key={idx}>
            {/* Step node */}
            <div
              style={{
                width: stepWidth,
                opacity: entrance,
                transform: `scale(${entrance}) translateY(${interpolate(entrance, [0, 1], [30, 0])}px)`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              {/* Circle with number */}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  border: `3px solid ${stepColor}`,
                  backgroundColor: `${stepColor}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                {step.icon ? (
                  <IconAnimation
                    icon={step.icon}
                    size={32}
                    color={stepColor}
                    startFrame={delay}
                    animation="scale"
                  />
                ) : (
                  <span
                    style={{
                      color: stepColor,
                      fontSize: 28,
                      fontWeight: 700,
                      fontFamily: MK12_FONTS.heading,
                    }}
                  >
                    {idx + 1}
                  </span>
                )}
              </div>

              {/* Label */}
              <div
                style={{
                  color: MK12_COLORS.foreground,
                  fontSize: 20,
                  fontWeight: 600,
                  fontFamily: MK12_FONTS.heading,
                  marginBottom: 8,
                }}
              >
                {step.label}
              </div>

              {/* Description */}
              {step.description && (
                <div
                  style={{
                    color: MK12_COLORS.mutedForeground,
                    fontSize: 14,
                    fontFamily: MK12_FONTS.body,
                    lineHeight: 1.4,
                    maxWidth: stepWidth - 20,
                  }}
                >
                  {step.description}
                </div>
              )}

              {/* Value badge */}
              {step.value !== undefined && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "4px 12px",
                    borderRadius: 12,
                    backgroundColor: `${stepColor}30`,
                    color: stepColor,
                    fontSize: 16,
                    fontWeight: 700,
                    fontFamily: MK12_FONTS.mono,
                  }}
                >
                  {step.value}%
                </div>
              )}
            </div>

            {/* Connector arrow */}
            {idx < steps.length - 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginTop: -60,
                  opacity: connectorProgress,
                }}
              >
                <div
                  style={{
                    width: interpolate(connectorProgress, [0, 1], [0, 40]),
                    height: 2,
                    backgroundColor: MK12_COLORS.border,
                  }}
                />
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: "6px solid transparent",
                    borderBottom: "6px solid transparent",
                    borderLeft: `8px solid ${MK12_COLORS.border}`,
                  }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── Bars Layout (horizontal progress bars) ─────────────────────────────────

const BarsLayout: React.FC<{
  steps: InfoGraphicStep[];
  accentColor: string;
  frame: number;
  fps: number;
}> = ({ steps, accentColor, frame, fps }) => {
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        maxWidth: 800,
      }}
    >
      {steps.map((step, idx) => {
        const delay = 25 + idx * 10;
        const entrance = spring({
          frame: frame - delay,
          fps,
          config: { damping: 16, stiffness: 140, mass: 0.8 },
        });

        const stepColor = step.color || accentColor;
        const value = step.value ?? 50;
        const fillWidth = interpolate(entrance, [0, 1], [0, value]);

        return (
          <div
            key={idx}
            style={{
              opacity: entrance,
              transform: `translateX(${interpolate(entrance, [0, 1], [-30, 0])}px)`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {step.icon && (
                  <IconAnimation
                    icon={step.icon}
                    size={24}
                    color={stepColor}
                    startFrame={delay}
                    animation="scale"
                  />
                )}
                <span
                  style={{
                    color: MK12_COLORS.foreground,
                    fontSize: 18,
                    fontWeight: 600,
                    fontFamily: MK12_FONTS.heading,
                  }}
                >
                  {step.label}
                </span>
              </div>
              <span
                style={{
                  color: stepColor,
                  fontSize: 20,
                  fontWeight: 700,
                  fontFamily: MK12_FONTS.mono,
                }}
              >
                {Math.round(fillWidth)}%
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: 16,
                backgroundColor: MK12_COLORS.secondary,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${fillWidth}%`,
                  height: "100%",
                  backgroundColor: stepColor,
                  borderRadius: 8,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── Cards Layout (stacked info cards) ──────────────────────────────────────

const CardsLayout: React.FC<{
  steps: InfoGraphicStep[];
  accentColor: string;
  frame: number;
  fps: number;
}> = ({ steps, accentColor, frame, fps }) => {
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexWrap: "wrap",
        gap: 20,
        justifyContent: "center",
      }}
    >
      {steps.map((step, idx) => {
        const delay = 25 + idx * 8;
        const entrance = spring({
          frame: frame - delay,
          fps,
          config: { damping: 14, stiffness: 160, mass: 0.7 },
        });

        const stepColor = step.color || accentColor;

        return (
          <div
            key={idx}
            style={{
              width: 260,
              padding: 24,
              backgroundColor: `${MK12_COLORS.card}cc`,
              border: `1px solid ${MK12_COLORS.borderDim}`,
              borderRadius: 12,
              opacity: entrance,
              transform: `translateY(${interpolate(entrance, [0, 1], [40, 0])}px) scale(${interpolate(entrance, [0, 1], [0.9, 1])})`,
            }}
          >
            {/* Top accent bar */}
            <div
              style={{
                width: 40,
                height: 3,
                backgroundColor: stepColor,
                borderRadius: 2,
                marginBottom: 16,
              }}
            />

            {step.icon && (
              <div style={{ marginBottom: 12 }}>
                <IconAnimation
                  icon={step.icon}
                  size={36}
                  color={stepColor}
                  startFrame={delay + 4}
                  animation="scale"
                />
              </div>
            )}

            <div
              style={{
                color: MK12_COLORS.foreground,
                fontSize: 18,
                fontWeight: 600,
                fontFamily: MK12_FONTS.heading,
                marginBottom: 8,
              }}
            >
              {step.label}
            </div>

            {step.description && (
              <div
                style={{
                  color: MK12_COLORS.mutedForeground,
                  fontSize: 13,
                  fontFamily: MK12_FONTS.body,
                  lineHeight: 1.5,
                }}
              >
                {step.description}
              </div>
            )}

            {step.value !== undefined && (
              <div
                style={{
                  marginTop: 14,
                  color: stepColor,
                  fontSize: 28,
                  fontWeight: 800,
                  fontFamily: MK12_FONTS.mono,
                }}
              >
                {Math.round(interpolate(entrance, [0, 1], [0, step.value]))}
                <span style={{ fontSize: 16, fontWeight: 500 }}>%</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
