import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { MK12_COLORS, MK12_FONTS, MK12_TYPOGRAPHY } from "../styles/theme";
import { BackgroundGradient, Vignette } from "../components/BackgroundGradient";
import { IconAnimation } from "../components/IconAnimation";

// ─── StockFootagePlaceholder Props ──────────────────────────────────────────
// Generates a styled placeholder card showing what stock footage to search for.

export interface StockFootagePlaceholderProps {
  /** The search query to display */
  searchQuery: string;
  /** Brief description of what the footage should show */
  description?: string;
  /** Scenario context from the content mark */
  scenario?: string;
  /** Suggested sources (e.g., "Getty Images", "Pexels") */
  sources?: string[];
  /** Duration this footage should fill (in seconds) */
  targetDuration?: number;
  /** Accent color */
  accentColor?: string;
}

export const StockFootagePlaceholder: React.FC<StockFootagePlaceholderProps> = ({
  searchQuery,
  description,
  scenario,
  sources = ["Getty Images", "Pexels", "Shutterstock"],
  targetDuration,
  accentColor = MK12_COLORS.markStockVideo,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Main entrance
  const entrance = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 120, mass: 0.9 },
    durationInFrames: 25,
  });

  // Exit
  const exitStart = durationInFrames - 20;
  const exit =
    frame > exitStart
      ? interpolate(frame, [exitStart, durationInFrames], [1, 0], {
          extrapolateRight: "clamp",
        })
      : 1;

  // Pulsing border animation
  const pulseOpacity = interpolate(
    Math.sin(frame * 0.08),
    [-1, 1],
    [0.3, 0.7],
  );

  // Scanning line animation
  const scanY = interpolate(
    frame % 90,
    [0, 90],
    [0, 100],
  );

  return (
    <BackgroundGradient
      colorA="#0a1a0a"
      colorB="#0a0a14"
      animate={true}
      speed={0.15}
      showGrid={true}
    >
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 80,
          opacity: entrance * exit,
        }}
      >
        {/* Main card */}
        <div
          style={{
            width: 900,
            padding: 48,
            backgroundColor: `${MK12_COLORS.card}dd`,
            border: `2px solid ${accentColor}`,
            borderRadius: 16,
            borderColor: accentColor,
            opacity: pulseOpacity + 0.5,
            position: "relative",
            overflow: "hidden",
            transform: `scale(${interpolate(entrance, [0, 1], [0.9, 1])})`,
          }}
        >
          {/* Scanning line effect */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${scanY}%`,
              height: 2,
              backgroundColor: accentColor,
              opacity: 0.15,
              boxShadow: `0 0 20px ${accentColor}`,
            }}
          />

          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 32,
            }}
          >
            <IconAnimation
              icon="cloud"
              size={40}
              color={accentColor}
              startFrame={8}
              animation="pulse"
            />
            <div>
              <div
                style={{
                  ...MK12_TYPOGRAPHY.label,
                  color: accentColor,
                  fontFamily: MK12_FONTS.mono,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                }}
              >
                Stock Footage Required
              </div>
            </div>
          </div>

          {/* Search query (main content) */}
          <div
            style={{
              ...MK12_TYPOGRAPHY.h2,
              fontFamily: MK12_FONTS.heading,
              color: MK12_COLORS.foreground,
              marginBottom: 20,
              opacity: spring({
                frame: frame - 12,
                fps,
                config: { damping: 18, stiffness: 120 },
              }),
            }}
          >
            &ldquo;{searchQuery}&rdquo;
          </div>

          {/* Scenario */}
          {scenario && (
            <div
              style={{
                fontSize: 18,
                color: MK12_COLORS.mutedForeground,
                fontFamily: MK12_FONTS.body,
                marginBottom: 16,
                lineHeight: 1.5,
                opacity: spring({
                  frame: frame - 18,
                  fps,
                  config: { damping: 18, stiffness: 120 },
                }),
              }}
            >
              Scenario: {scenario}
            </div>
          )}

          {/* Description */}
          {description && (
            <div
              style={{
                fontSize: 16,
                color: MK12_COLORS.mutedForeground,
                fontFamily: MK12_FONTS.body,
                marginBottom: 24,
                lineHeight: 1.5,
                opacity: spring({
                  frame: frame - 22,
                  fps,
                  config: { damping: 18, stiffness: 120 },
                }),
              }}
            >
              {description}
            </div>
          )}

          {/* Footer: sources + duration */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: 20,
              borderTop: `1px solid ${MK12_COLORS.borderDim}`,
              opacity: spring({
                frame: frame - 28,
                fps,
                config: { damping: 18, stiffness: 120 },
              }),
            }}
          >
            {/* Sources */}
            <div style={{ display: "flex", gap: 8 }}>
              {sources.map((source, i) => (
                <div
                  key={i}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 6,
                    backgroundColor: MK12_COLORS.accent,
                    color: MK12_COLORS.mutedForeground,
                    fontSize: 12,
                    fontFamily: MK12_FONTS.body,
                    fontWeight: 500,
                  }}
                >
                  {source}
                </div>
              ))}
            </div>

            {/* Duration */}
            {targetDuration && (
              <div
                style={{
                  color: accentColor,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: MK12_FONTS.mono,
                }}
              >
                Target: {targetDuration}s
              </div>
            )}
          </div>
        </div>

        {/* Bottom status bar */}
        <div
          style={{
            marginTop: 24,
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: spring({
              frame: frame - 35,
              fps,
              config: { damping: 18, stiffness: 120 },
            }),
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: accentColor,
              opacity: interpolate(Math.sin(frame * 0.15), [-1, 1], [0.4, 1]),
            }}
          />
          <span
            style={{
              color: MK12_COLORS.mutedForeground,
              fontSize: 13,
              fontFamily: MK12_FONTS.mono,
            }}
          >
            Awaiting footage selection
          </span>
        </div>
      </AbsoluteFill>
      <Vignette intensity={0.5} />
    </BackgroundGradient>
  );
};
