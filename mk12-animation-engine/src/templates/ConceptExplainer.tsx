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
import { FadeInText } from "../components/AnimatedText";

// ─── ConceptExplainer Props ─────────────────────────────────────────────────
// Animated concept explanation with bullet points and icons.

export interface ConceptPoint {
  text: string;
  icon?: string;
  detail?: string;
}

export interface ConceptExplainerProps {
  /** Main concept title */
  title: string;
  /** Brief intro text */
  intro?: string;
  /** Key points to explain */
  points: ConceptPoint[];
  /** Summary text shown at end */
  conclusion?: string;
  /** Accent color */
  accentColor?: string;
  /** Gradient colors */
  gradientStart?: string;
  gradientEnd?: string;
}

export const ConceptExplainer: React.FC<ConceptExplainerProps> = ({
  title,
  intro,
  points,
  conclusion,
  accentColor = MK12_COLORS.markAnimation,
  gradientStart = "#0a0a14",
  gradientEnd = "#140a1a",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Title entrance
  const titleEntrance = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 120, mass: 0.8 },
    durationInFrames: 22,
  });

  // Intro entrance
  const introEntrance = spring({
    frame: frame - 15,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
  });

  // Exit
  const exitStart = durationInFrames - 20;
  const exitProgress =
    frame > exitStart
      ? interpolate(frame, [exitStart, durationInFrames], [1, 0], {
          extrapolateRight: "clamp",
        })
      : 1;

  // Progress through all points
  const totalPoints = points.length;
  const pointStartFrame = 30;
  const framesPerPoint = Math.floor(
    (durationInFrames - pointStartFrame - 40) / Math.max(totalPoints, 1),
  );

  // Conclusion entrance
  const conclusionStart = pointStartFrame + totalPoints * framesPerPoint;
  const conclusionEntrance = spring({
    frame: frame - conclusionStart,
    fps,
    config: { damping: 18, stiffness: 120 },
  });

  // Progress bar showing how far through the explanation we are
  const overallProgress = interpolate(
    frame,
    [pointStartFrame, conclusionStart],
    [0, 100],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

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
          padding: "60px 80px",
          opacity: exitProgress,
          display: "flex",
          flexDirection: "row",
          gap: 60,
        }}
      >
        {/* Left column: Title + progress */}
        <div
          style={{
            width: 400,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          {/* Accent dot */}
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: accentColor,
              marginBottom: 20,
              opacity: titleEntrance,
              transform: `scale(${titleEntrance})`,
            }}
          />

          {/* Title */}
          <div
            style={{
              ...MK12_TYPOGRAPHY.h1,
              fontFamily: MK12_FONTS.heading,
              color: MK12_COLORS.foreground,
              opacity: titleEntrance,
              transform: `translateY(${interpolate(titleEntrance, [0, 1], [25, 0])}px)`,
              marginBottom: 16,
            }}
          >
            {title}
          </div>

          {/* Intro */}
          {intro && (
            <div
              style={{
                ...MK12_TYPOGRAPHY.body,
                fontFamily: MK12_FONTS.body,
                color: MK12_COLORS.mutedForeground,
                opacity: introEntrance,
                transform: `translateY(${interpolate(introEntrance, [0, 1], [15, 0])}px)`,
                marginBottom: 32,
              }}
            >
              {intro}
            </div>
          )}

          {/* Progress indicator */}
          <div style={{ marginTop: "auto" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  ...MK12_TYPOGRAPHY.caption,
                  color: MK12_COLORS.mutedForeground,
                  fontFamily: MK12_FONTS.body,
                }}
              >
                Progress
              </span>
              <span
                style={{
                  ...MK12_TYPOGRAPHY.caption,
                  color: accentColor,
                  fontFamily: MK12_FONTS.mono,
                  fontWeight: 700,
                }}
              >
                {Math.round(overallProgress)}%
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: 4,
                backgroundColor: MK12_COLORS.secondary,
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${overallProgress}%`,
                  height: "100%",
                  backgroundColor: accentColor,
                  borderRadius: 2,
                }}
              />
            </div>

            {/* Point counter */}
            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 6,
              }}
            >
              {points.map((_, idx) => {
                const pointFrame = pointStartFrame + idx * framesPerPoint;
                const active = frame >= pointFrame;
                return (
                  <div
                    key={idx}
                    style={{
                      width: 24,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: active ? accentColor : MK12_COLORS.secondary,
                      transition: "background-color 0.3s",
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column: Points */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 20,
          }}
        >
          {points.map((point, idx) => {
            const pointDelay = pointStartFrame + idx * framesPerPoint;
            const pointEntrance = spring({
              frame: frame - pointDelay,
              fps,
              config: { damping: 14, stiffness: 160, mass: 0.7 },
            });

            const isActive = frame >= pointDelay;
            const isCurrent =
              frame >= pointDelay &&
              (idx === points.length - 1 || frame < pointDelay + framesPerPoint);

            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 20,
                  padding: "16px 20px",
                  backgroundColor: isCurrent
                    ? `${accentColor}12`
                    : "transparent",
                  borderRadius: 12,
                  border: isCurrent
                    ? `1px solid ${accentColor}30`
                    : "1px solid transparent",
                  opacity: isActive ? pointEntrance : 0.15,
                  transform: `translateX(${interpolate(
                    isActive ? pointEntrance : 0,
                    [0, 1],
                    [30, 0],
                  )}px)`,
                }}
              >
                {/* Icon or bullet */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: isActive
                      ? `${accentColor}20`
                      : MK12_COLORS.accent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {point.icon ? (
                    <IconAnimation
                      icon={point.icon}
                      size={24}
                      color={isActive ? accentColor : MK12_COLORS.mutedForeground}
                      startFrame={pointDelay}
                      animation="scale"
                    />
                  ) : (
                    <span
                      style={{
                        color: isActive ? accentColor : MK12_COLORS.mutedForeground,
                        fontSize: 18,
                        fontWeight: 700,
                        fontFamily: MK12_FONTS.heading,
                      }}
                    >
                      {idx + 1}
                    </span>
                  )}
                </div>

                {/* Text */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 600,
                      color: isActive
                        ? MK12_COLORS.foreground
                        : MK12_COLORS.mutedForeground,
                      fontFamily: MK12_FONTS.heading,
                      marginBottom: point.detail ? 6 : 0,
                    }}
                  >
                    {point.text}
                  </div>
                  {point.detail && (
                    <div
                      style={{
                        fontSize: 15,
                        color: MK12_COLORS.mutedForeground,
                        fontFamily: MK12_FONTS.body,
                        lineHeight: 1.5,
                        opacity: isActive
                          ? spring({
                              frame: frame - pointDelay - 8,
                              fps,
                              config: { damping: 18, stiffness: 120 },
                            })
                          : 0,
                      }}
                    >
                      {point.detail}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Conclusion */}
          {conclusion && frame >= conclusionStart && (
            <div
              style={{
                marginTop: 16,
                padding: "16px 20px",
                borderLeft: `3px solid ${accentColor}`,
                opacity: conclusionEntrance,
                transform: `translateY(${interpolate(conclusionEntrance, [0, 1], [15, 0])}px)`,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  color: MK12_COLORS.foreground,
                  fontFamily: MK12_FONTS.body,
                  fontStyle: "italic",
                  lineHeight: 1.5,
                }}
              >
                {conclusion}
              </div>
            </div>
          )}
        </div>
      </AbsoluteFill>
      <Vignette intensity={0.35} />
    </BackgroundGradient>
  );
};
