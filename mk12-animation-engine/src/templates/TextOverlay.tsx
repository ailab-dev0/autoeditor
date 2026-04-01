import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { MK12_COLORS, MK12_FONTS, MK12_TYPOGRAPHY } from "../styles/theme";

// ─── TextOverlay Props ──────────────────────────────────────────────────────
// Title cards, lower thirds, quotes, speaker name overlays.

export type TextOverlayVariant = "title_card" | "lower_third" | "quote" | "full_screen";

export interface TextOverlayProps {
  /** Main text content */
  text: string;
  /** Secondary line (subtitle, speaker name, attribution) */
  secondaryText?: string;
  /** Third line (role, date, etc.) */
  tertiaryText?: string;
  /** Layout variant */
  variant?: TextOverlayVariant;
  /** Accent color for decorative elements */
  accentColor?: string;
  /** Text alignment */
  align?: "left" | "center" | "right";
  /** Whether to show on transparent background (for compositing) */
  transparent?: boolean;
}

export const TextOverlay: React.FC<TextOverlayProps> = ({
  text,
  secondaryText,
  tertiaryText,
  variant = "lower_third",
  accentColor = MK12_COLORS.primary,
  align = "left",
  transparent = false,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Entrance animation
  const entrance = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 140, mass: 0.8 },
    durationInFrames: 20,
  });

  // Exit animation
  const exitStart = durationInFrames - 15;
  const exit =
    frame > exitStart
      ? interpolate(frame, [exitStart, durationInFrames], [1, 0], {
          extrapolateRight: "clamp",
        })
      : 1;

  const opacity = entrance * exit;

  switch (variant) {
    case "title_card":
      return (
        <TitleCard
          text={text}
          secondaryText={secondaryText}
          accentColor={accentColor}
          align={align}
          opacity={opacity}
          entrance={entrance}
          transparent={transparent}
          frame={frame}
          fps={fps}
        />
      );
    case "lower_third":
      return (
        <LowerThird
          text={text}
          secondaryText={secondaryText}
          tertiaryText={tertiaryText}
          accentColor={accentColor}
          opacity={opacity}
          entrance={entrance}
          transparent={transparent}
          frame={frame}
          fps={fps}
        />
      );
    case "quote":
      return (
        <QuoteCard
          text={text}
          secondaryText={secondaryText}
          accentColor={accentColor}
          opacity={opacity}
          entrance={entrance}
          transparent={transparent}
          frame={frame}
          fps={fps}
        />
      );
    case "full_screen":
      return (
        <FullScreenText
          text={text}
          secondaryText={secondaryText}
          accentColor={accentColor}
          opacity={opacity}
          entrance={entrance}
          transparent={transparent}
          frame={frame}
          fps={fps}
        />
      );
  }
};

// ─── Title Card ─────────────────────────────────────────────────────────────

const TitleCard: React.FC<{
  text: string;
  secondaryText?: string;
  accentColor: string;
  align: string;
  opacity: number;
  entrance: number;
  transparent: boolean;
  frame: number;
  fps: number;
}> = ({ text, secondaryText, accentColor, align, opacity, entrance, transparent, frame, fps }) => {
  const secondaryEntrance = spring({
    frame: frame - 10,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : MK12_COLORS.background,
        justifyContent: "center",
        alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
        padding: 100,
      }}
    >
      <div style={{ opacity, textAlign: align as React.CSSProperties["textAlign"] }}>
        {/* Accent line */}
        <div
          style={{
            width: interpolate(entrance, [0, 1], [0, 60]),
            height: 4,
            backgroundColor: accentColor,
            borderRadius: 2,
            marginBottom: 24,
            ...(align === "center" ? { margin: "0 auto 24px" } : {}),
            ...(align === "right" ? { marginLeft: "auto", marginBottom: 24 } : {}),
          }}
        />

        <div
          style={{
            ...MK12_TYPOGRAPHY.display,
            fontFamily: MK12_FONTS.heading,
            color: MK12_COLORS.foreground,
            transform: `translateY(${interpolate(entrance, [0, 1], [30, 0])}px)`,
          }}
        >
          {text}
        </div>

        {secondaryText && (
          <div
            style={{
              ...MK12_TYPOGRAPHY.bodyLarge,
              fontFamily: MK12_FONTS.body,
              color: MK12_COLORS.mutedForeground,
              marginTop: 16,
              opacity: secondaryEntrance,
              transform: `translateY(${interpolate(secondaryEntrance, [0, 1], [15, 0])}px)`,
            }}
          >
            {secondaryText}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ─── Lower Third ────────────────────────────────────────────────────────────

const LowerThird: React.FC<{
  text: string;
  secondaryText?: string;
  tertiaryText?: string;
  accentColor: string;
  opacity: number;
  entrance: number;
  transparent: boolean;
  frame: number;
  fps: number;
}> = ({ text, secondaryText, tertiaryText, accentColor, opacity, entrance, transparent, frame, fps }) => {
  const barWidth = interpolate(entrance, [0, 1], [0, 1]);

  const textEntrance = spring({
    frame: frame - 8,
    fps,
    config: { damping: 16, stiffness: 140 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : undefined,
        justifyContent: "flex-end",
        padding: "0 80px 100px",
      }}
    >
      {!transparent && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 30%, transparent 60%)`,
          }}
        />
      )}

      <div style={{ opacity, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "stretch", gap: 16 }}>
          {/* Accent bar */}
          <div
            style={{
              width: 4,
              backgroundColor: accentColor,
              borderRadius: 2,
              transform: `scaleY(${barWidth})`,
              transformOrigin: "bottom",
            }}
          />

          <div>
            {/* Primary text (name) */}
            <div
              style={{
                fontSize: 32,
                fontWeight: 700,
                color: MK12_COLORS.foreground,
                fontFamily: MK12_FONTS.heading,
                opacity: textEntrance,
                transform: `translateX(${interpolate(textEntrance, [0, 1], [-20, 0])}px)`,
              }}
            >
              {text}
            </div>

            {/* Secondary text (role/title) */}
            {secondaryText && (
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 400,
                  color: accentColor,
                  fontFamily: MK12_FONTS.body,
                  marginTop: 4,
                  opacity: spring({
                    frame: frame - 14,
                    fps,
                    config: { damping: 18, stiffness: 120 },
                  }),
                  transform: `translateX(${interpolate(
                    spring({ frame: frame - 14, fps, config: { damping: 18, stiffness: 120 } }),
                    [0, 1],
                    [-15, 0],
                  )}px)`,
                }}
              >
                {secondaryText}
              </div>
            )}

            {/* Tertiary text */}
            {tertiaryText && (
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: MK12_COLORS.mutedForeground,
                  fontFamily: MK12_FONTS.body,
                  marginTop: 4,
                  opacity: spring({
                    frame: frame - 18,
                    fps,
                    config: { damping: 18, stiffness: 120 },
                  }),
                }}
              >
                {tertiaryText}
              </div>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Quote Card ─────────────────────────────────────────────────────────────

const QuoteCard: React.FC<{
  text: string;
  secondaryText?: string;
  accentColor: string;
  opacity: number;
  entrance: number;
  transparent: boolean;
  frame: number;
  fps: number;
}> = ({ text, secondaryText, accentColor, opacity, entrance, transparent, frame, fps }) => {
  const quoteMarkEntrance = spring({
    frame: frame - 5,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.6 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : MK12_COLORS.background,
        justifyContent: "center",
        alignItems: "center",
        padding: 120,
      }}
    >
      <div
        style={{
          opacity,
          maxWidth: 1200,
          textAlign: "center",
        }}
      >
        {/* Opening quote mark */}
        <div
          style={{
            fontSize: 120,
            fontWeight: 800,
            color: accentColor,
            lineHeight: 0.6,
            opacity: quoteMarkEntrance * 0.3,
            transform: `scale(${quoteMarkEntrance})`,
            fontFamily: "Georgia, serif",
            marginBottom: 20,
          }}
        >
          &ldquo;
        </div>

        {/* Quote text */}
        <div
          style={{
            ...MK12_TYPOGRAPHY.h2,
            fontFamily: MK12_FONTS.heading,
            color: MK12_COLORS.foreground,
            fontStyle: "italic",
            transform: `translateY(${interpolate(entrance, [0, 1], [20, 0])}px)`,
          }}
        >
          {text}
        </div>

        {/* Attribution */}
        {secondaryText && (
          <div
            style={{
              marginTop: 32,
              fontSize: 18,
              color: MK12_COLORS.mutedForeground,
              fontFamily: MK12_FONTS.body,
              opacity: spring({
                frame: frame - 15,
                fps,
                config: { damping: 18, stiffness: 120 },
              }),
            }}
          >
            &mdash; {secondaryText}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// ─── Full Screen Text ───────────────────────────────────────────────────────

const FullScreenText: React.FC<{
  text: string;
  secondaryText?: string;
  accentColor: string;
  opacity: number;
  entrance: number;
  transparent: boolean;
  frame: number;
  fps: number;
}> = ({ text, secondaryText, accentColor, opacity, entrance, transparent, frame, fps }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : MK12_COLORS.background,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ opacity, textAlign: "center" }}>
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            color: MK12_COLORS.foreground,
            fontFamily: MK12_FONTS.heading,
            letterSpacing: -3,
            lineHeight: 1.05,
            transform: `scale(${interpolate(entrance, [0, 1], [0.8, 1])})`,
          }}
        >
          {text}
        </div>

        {secondaryText && (
          <div
            style={{
              marginTop: 24,
              fontSize: 28,
              fontWeight: 400,
              color: accentColor,
              fontFamily: MK12_FONTS.body,
              opacity: spring({
                frame: frame - 12,
                fps,
                config: { damping: 18, stiffness: 120 },
              }),
            }}
          >
            {secondaryText}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
