import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { MK12_FONTS } from "../styles/theme";

// ─── Typewriter Effect ──────────────────────────────────────────────────────

interface TypewriterProps {
  text: string;
  startFrame?: number;
  charFrames?: number;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  cursorColor?: string;
  showCursor?: boolean;
  fontFamily?: string;
}

export const Typewriter: React.FC<TypewriterProps> = ({
  text,
  startFrame = 0,
  charFrames = 2,
  fontSize = 32,
  fontWeight = 600,
  color = "#ffffff",
  cursorColor = "#0B84F3",
  showCursor = true,
  fontFamily = MK12_FONTS.heading,
}) => {
  const frame = useCurrentFrame();
  const relFrame = Math.max(0, frame - startFrame);

  const typedCount = Math.min(text.length, Math.floor(relFrame / charFrames));
  const typedText = text.slice(0, typedCount);
  const done = typedCount >= text.length;

  const cursorBlink = interpolate(
    relFrame % 20,
    [0, 10, 20],
    [1, 0, 1],
    { extrapolateRight: "clamp" },
  );

  return (
    <span
      style={{
        fontSize,
        fontWeight,
        color,
        fontFamily,
        whiteSpace: "pre-wrap",
      }}
    >
      {typedText}
      {showCursor && !done && (
        <span style={{ color: cursorColor, opacity: cursorBlink }}>|</span>
      )}
    </span>
  );
};

// ─── Fade-In Text ───────────────────────────────────────────────────────────

interface FadeInTextProps {
  text: string;
  startFrame?: number;
  durationFrames?: number;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  fontFamily?: string;
  direction?: "up" | "down" | "left" | "right" | "none";
  offsetDistance?: number;
}

export const FadeInText: React.FC<FadeInTextProps> = ({
  text,
  startFrame = 0,
  durationFrames = 20,
  fontSize = 32,
  fontWeight = 600,
  color = "#ffffff",
  fontFamily = MK12_FONTS.heading,
  direction = "up",
  offsetDistance = 30,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
    durationInFrames: durationFrames,
  });

  const opacity = progress;

  let translateX = 0;
  let translateY = 0;

  switch (direction) {
    case "up":
      translateY = interpolate(progress, [0, 1], [offsetDistance, 0]);
      break;
    case "down":
      translateY = interpolate(progress, [0, 1], [-offsetDistance, 0]);
      break;
    case "left":
      translateX = interpolate(progress, [0, 1], [offsetDistance, 0]);
      break;
    case "right":
      translateX = interpolate(progress, [0, 1], [-offsetDistance, 0]);
      break;
  }

  return (
    <div
      style={{
        fontSize,
        fontWeight,
        color,
        fontFamily,
        opacity,
        transform: `translate(${translateX}px, ${translateY}px)`,
        whiteSpace: "pre-wrap",
      }}
    >
      {text}
    </div>
  );
};

// ─── Slide Text (word-by-word entrance) ─────────────────────────────────────

interface SlideTextProps {
  text: string;
  startFrame?: number;
  wordDelay?: number;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  fontFamily?: string;
}

export const SlideText: React.FC<SlideTextProps> = ({
  text,
  startFrame = 0,
  wordDelay = 5,
  fontSize = 32,
  fontWeight = 600,
  color = "#ffffff",
  fontFamily = MK12_FONTS.heading,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: fontSize * 0.3,
        fontSize,
        fontWeight,
        fontFamily,
      }}
    >
      {words.map((word, i) => {
        const delay = startFrame + i * wordDelay;
        const progress = spring({
          frame: frame - delay,
          fps,
          config: { damping: 14, stiffness: 160, mass: 0.7 },
        });

        return (
          <span
            key={i}
            style={{
              color,
              opacity: progress,
              transform: `translateY(${interpolate(progress, [0, 1], [20, 0])}px)`,
              display: "inline-block",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
