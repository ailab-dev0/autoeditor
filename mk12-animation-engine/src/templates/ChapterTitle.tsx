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

// ─── ChapterTitle Props ─────────────────────────────────────────────────────
// Chapter intro animation with number, title, and duration.

export interface ChapterTitleProps {
  /** Chapter number */
  chapterNumber: number;
  /** Chapter title */
  title: string;
  /** Chapter subtitle or description */
  subtitle?: string;
  /** Duration of the chapter (formatted, e.g. "4:32") */
  duration?: string;
  /** Total number of chapters (for "Chapter X of Y") */
  totalChapters?: number;
  /** Accent color */
  accentColor?: string;
  /** Gradient colors */
  gradientStart?: string;
  gradientEnd?: string;
}

export const ChapterTitle: React.FC<ChapterTitleProps> = ({
  chapterNumber,
  title,
  subtitle,
  duration,
  totalChapters,
  accentColor = MK12_COLORS.markChapter,
  gradientStart = "#0a0a14",
  gradientEnd = "#0a1420",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // ─── Entrance animations ────────────────────────────────────────────

  // Large chapter number (comes in first)
  const numberEntrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80, mass: 1.2 },
    durationInFrames: 30,
  });

  // "CHAPTER" label
  const labelEntrance = spring({
    frame: frame - 8,
    fps,
    config: { damping: 16, stiffness: 140, mass: 0.8 },
  });

  // Title text
  const titleEntrance = spring({
    frame: frame - 16,
    fps,
    config: { damping: 16, stiffness: 120, mass: 0.9 },
    durationInFrames: 22,
  });

  // Subtitle
  const subtitleEntrance = spring({
    frame: frame - 24,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
  });

  // Duration badge
  const badgeEntrance = spring({
    frame: frame - 30,
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.7 },
  });

  // Decorative line
  const lineWidth = interpolate(
    spring({
      frame: frame - 12,
      fps,
      config: { damping: 20, stiffness: 80 },
    }),
    [0, 1],
    [0, 200],
  );

  // ─── Exit animation ─────────────────────────────────────────────────

  const exitStart = durationInFrames - 20;
  const exitProgress =
    frame > exitStart
      ? interpolate(frame, [exitStart, durationInFrames], [1, 0], {
          extrapolateRight: "clamp",
        })
      : 1;

  // Subtle floating dots in background
  const dots = Array.from({ length: 6 }, (_, i) => ({
    x: 200 + i * 280,
    y: 200 + Math.sin(i * 1.5) * 150,
    size: 4 + (i % 3) * 2,
    speed: 0.02 + i * 0.005,
    opacity: 0.08 + (i % 3) * 0.04,
  }));

  return (
    <BackgroundGradient
      colorA={gradientStart}
      colorB={gradientEnd}
      animate={true}
      speed={0.3}
      showGrid={true}
    >
      {/* Floating background elements */}
      {dots.map((dot, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: dot.x,
            top: dot.y + Math.sin(frame * dot.speed + i) * 30,
            width: dot.size,
            height: dot.size,
            borderRadius: dot.size / 2,
            backgroundColor: accentColor,
            opacity: dot.opacity * numberEntrance,
          }}
        />
      ))}

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: exitProgress,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            maxWidth: 1200,
          }}
        >
          {/* "CHAPTER" label */}
          <div
            style={{
              ...MK12_TYPOGRAPHY.label,
              fontFamily: MK12_FONTS.mono,
              color: accentColor,
              textTransform: "uppercase",
              letterSpacing: 6,
              marginBottom: 12,
              opacity: labelEntrance,
              transform: `translateY(${interpolate(labelEntrance, [0, 1], [-10, 0])}px)`,
            }}
          >
            Chapter{totalChapters ? ` ${chapterNumber} of ${totalChapters}` : ""}
          </div>

          {/* Large chapter number */}
          <div
            style={{
              fontSize: 160,
              fontWeight: 900,
              fontFamily: MK12_FONTS.heading,
              color: `${accentColor}15`,
              lineHeight: 0.9,
              opacity: numberEntrance,
              transform: `scale(${interpolate(numberEntrance, [0, 1], [0.6, 1])})`,
              position: "absolute",
              top: "50%",
              left: "50%",
              marginLeft: -80,
              marginTop: -100,
              zIndex: 0,
              userSelect: "none",
            }}
          >
            {String(chapterNumber).padStart(2, "0")}
          </div>

          {/* Decorative line */}
          <div
            style={{
              width: lineWidth,
              height: 2,
              backgroundColor: accentColor,
              borderRadius: 1,
              marginBottom: 28,
              opacity: 0.6,
            }}
          />

          {/* Chapter title */}
          <div
            style={{
              ...MK12_TYPOGRAPHY.display,
              fontFamily: MK12_FONTS.heading,
              color: MK12_COLORS.foreground,
              opacity: titleEntrance,
              transform: `translateY(${interpolate(titleEntrance, [0, 1], [30, 0])}px)`,
              position: "relative",
              zIndex: 1,
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
                marginTop: 16,
                opacity: subtitleEntrance,
                transform: `translateY(${interpolate(subtitleEntrance, [0, 1], [15, 0])}px)`,
                maxWidth: 800,
                position: "relative",
                zIndex: 1,
              }}
            >
              {subtitle}
            </div>
          )}

          {/* Duration badge */}
          {duration && (
            <div
              style={{
                marginTop: 32,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 20px",
                borderRadius: 20,
                backgroundColor: `${accentColor}18`,
                border: `1px solid ${accentColor}30`,
                opacity: badgeEntrance,
                transform: `scale(${interpolate(badgeEntrance, [0, 1], [0.8, 1])})`,
              }}
            >
              {/* Clock icon */}
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill={accentColor}
              >
                <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
              </svg>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: accentColor,
                  fontFamily: MK12_FONTS.mono,
                }}
              >
                {duration}
              </span>
            </div>
          )}
        </div>
      </AbsoluteFill>
      <Vignette intensity={0.45} />
    </BackgroundGradient>
  );
};
