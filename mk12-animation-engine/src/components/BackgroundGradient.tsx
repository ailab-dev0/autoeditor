import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { MK12_COLORS } from "../styles/theme";

interface BackgroundGradientProps {
  /** Starting color */
  colorA?: string;
  /** Ending color */
  colorB?: string;
  /** Optional third color for tri-tone gradients */
  colorC?: string;
  /** Gradient direction in degrees (animates if animate=true) */
  angle?: number;
  /** Whether the gradient angle animates over time */
  animate?: boolean;
  /** Speed of animation (degrees per frame) */
  speed?: number;
  /** Overlay opacity for darkening (0-1) */
  overlayOpacity?: number;
  /** Show subtle grid pattern */
  showGrid?: boolean;
  /** Show subtle noise texture via CSS */
  showNoise?: boolean;
  children?: React.ReactNode;
}

export const BackgroundGradient: React.FC<BackgroundGradientProps> = ({
  colorA = MK12_COLORS.gradientPrimary[0],
  colorB = MK12_COLORS.gradientPrimary[1],
  colorC,
  angle = 135,
  animate = true,
  speed = 0.5,
  overlayOpacity = 0,
  showGrid = false,
  showNoise = false,
  children,
}) => {
  const frame = useCurrentFrame();

  const currentAngle = animate ? angle + frame * speed : angle;

  const colors = colorC
    ? `${colorA}, ${colorC}, ${colorB}`
    : `${colorA}, ${colorB}`;

  const gradientStyle: React.CSSProperties = {
    background: `linear-gradient(${currentAngle}deg, ${colors})`,
  };

  return (
    <AbsoluteFill style={gradientStyle}>
      {/* Dark overlay */}
      {overlayOpacity > 0 && (
        <AbsoluteFill
          style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity})` }}
        />
      )}

      {/* Grid pattern */}
      {showGrid && (
        <AbsoluteFill
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
      )}

      {/* Noise texture approximation via radial gradients */}
      {showNoise && (
        <AbsoluteFill
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 30%, rgba(255,255,255,0.02) 0%, transparent 50%),
              radial-gradient(circle at 80% 70%, rgba(255,255,255,0.02) 0%, transparent 50%),
              radial-gradient(circle at 50% 50%, rgba(0,0,0,0.05) 0%, transparent 70%)
            `,
          }}
        />
      )}

      {children}
    </AbsoluteFill>
  );
};

// ─── Preset backgrounds ─────────────────────────────────────────────────────

export const DarkBackground: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => (
  <BackgroundGradient
    colorA="#0a0a0a"
    colorB="#1a1a2e"
    animate={false}
    showGrid={true}
    showNoise={true}
  >
    {children}
  </BackgroundGradient>
);

export const PrimaryBackground: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => (
  <BackgroundGradient
    colorA={MK12_COLORS.gradientPrimary[0]}
    colorB={MK12_COLORS.gradientPrimary[1]}
    overlayOpacity={0.3}
    showGrid={true}
  >
    {children}
  </BackgroundGradient>
);

// ─── Animated vignette ring ─────────────────────────────────────────────────

interface VignetteProps {
  intensity?: number;
  color?: string;
}

export const Vignette: React.FC<VignetteProps> = ({
  intensity = 0.6,
  color = "#000000",
}) => {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, transparent 40%, ${color} 100%)`,
        opacity: intensity,
        pointerEvents: "none",
      }}
    />
  );
};
