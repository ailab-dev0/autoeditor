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
import { Typewriter } from "../components/AnimatedText";

// ─── ArticleReference Props ─────────────────────────────────────────────────
// News/article citation card for referencing external sources.

export interface ArticleReferenceProps {
  /** Article headline */
  headline: string;
  /** Publication or source name */
  source: string;
  /** Publication date or year */
  date?: string;
  /** Brief summary of the article's relevance */
  summary?: string;
  /** URL (displayed truncated) */
  url?: string;
  /** Section/category within the publication */
  section?: string;
  /** Author name(s) */
  author?: string;
  /** Accent color */
  accentColor?: string;
}

export const ArticleReference: React.FC<ArticleReferenceProps> = ({
  headline,
  source,
  date,
  summary,
  url,
  section,
  author,
  accentColor = MK12_COLORS.markArticle,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Entrance
  const cardEntrance = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 100, mass: 1 },
    durationInFrames: 25,
  });

  // Exit
  const exitStart = durationInFrames - 18;
  const exit =
    frame > exitStart
      ? interpolate(frame, [exitStart, durationInFrames], [1, 0], {
          extrapolateRight: "clamp",
        })
      : 1;

  // Staggered content entrances
  const sourceEntrance = spring({
    frame: frame - 8,
    fps,
    config: { damping: 16, stiffness: 140 },
  });

  const headlineReady = frame >= 15;

  const metaEntrance = spring({
    frame: frame - 40,
    fps,
    config: { damping: 18, stiffness: 120 },
  });

  const summaryEntrance = spring({
    frame: frame - 50,
    fps,
    config: { damping: 18, stiffness: 120 },
  });

  return (
    <BackgroundGradient
      colorA="#0f0a04"
      colorB="#1a1410"
      animate={true}
      speed={0.15}
      showNoise={true}
    >
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 80,
          opacity: cardEntrance * exit,
        }}
      >
        {/* Article card */}
        <div
          style={{
            width: 960,
            backgroundColor: `${MK12_COLORS.card}ee`,
            borderRadius: 16,
            overflow: "hidden",
            transform: `translateY(${interpolate(cardEntrance, [0, 1], [40, 0])}px)`,
            boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 1px ${accentColor}40`,
          }}
        >
          {/* Top accent bar */}
          <div
            style={{
              height: 4,
              width: `${interpolate(cardEntrance, [0, 1], [0, 100])}%`,
              backgroundColor: accentColor,
            }}
          />

          <div style={{ padding: "40px 48px" }}>
            {/* Source & section header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 24,
                opacity: sourceEntrance,
                transform: `translateX(${interpolate(sourceEntrance, [0, 1], [-20, 0])}px)`,
              }}
            >
              <IconAnimation
                icon="document"
                size={28}
                color={accentColor}
                startFrame={5}
                animation="scale"
              />
              <div>
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: accentColor,
                    fontFamily: MK12_FONTS.heading,
                  }}
                >
                  {source}
                </span>
                {section && (
                  <span
                    style={{
                      fontSize: 14,
                      color: MK12_COLORS.mutedForeground,
                      fontFamily: MK12_FONTS.body,
                      marginLeft: 12,
                      padding: "2px 8px",
                      backgroundColor: MK12_COLORS.accent,
                      borderRadius: 4,
                    }}
                  >
                    {section}
                  </span>
                )}
              </div>
            </div>

            {/* Headline with typewriter effect */}
            <div style={{ marginBottom: 24, minHeight: 80 }}>
              {headlineReady && (
                <Typewriter
                  text={headline}
                  startFrame={15}
                  charFrames={1}
                  fontSize={36}
                  fontWeight={700}
                  color={MK12_COLORS.foreground}
                  cursorColor={accentColor}
                  fontFamily={MK12_FONTS.heading}
                />
              )}
            </div>

            {/* Meta information */}
            <div
              style={{
                display: "flex",
                gap: 20,
                alignItems: "center",
                marginBottom: summary ? 24 : 0,
                opacity: metaEntrance,
              }}
            >
              {date && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <IconAnimation
                    icon="clock"
                    size={16}
                    color={MK12_COLORS.mutedForeground}
                    startFrame={38}
                    animation="scale"
                  />
                  <span
                    style={{
                      fontSize: 14,
                      color: MK12_COLORS.mutedForeground,
                      fontFamily: MK12_FONTS.body,
                    }}
                  >
                    {date}
                  </span>
                </div>
              )}

              {author && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <IconAnimation
                    icon="person"
                    size={16}
                    color={MK12_COLORS.mutedForeground}
                    startFrame={40}
                    animation="scale"
                  />
                  <span
                    style={{
                      fontSize: 14,
                      color: MK12_COLORS.mutedForeground,
                      fontFamily: MK12_FONTS.body,
                    }}
                  >
                    {author}
                  </span>
                </div>
              )}
            </div>

            {/* Summary */}
            {summary && (
              <div
                style={{
                  fontSize: 18,
                  color: MK12_COLORS.mutedForeground,
                  fontFamily: MK12_FONTS.body,
                  lineHeight: 1.6,
                  opacity: summaryEntrance,
                  transform: `translateY(${interpolate(summaryEntrance, [0, 1], [10, 0])}px)`,
                  borderLeft: `3px solid ${accentColor}40`,
                  paddingLeft: 16,
                }}
              >
                {summary}
              </div>
            )}

            {/* URL */}
            {url && (
              <div
                style={{
                  marginTop: 20,
                  fontSize: 12,
                  color: `${MK12_COLORS.mutedForeground}80`,
                  fontFamily: MK12_FONTS.mono,
                  opacity: summaryEntrance,
                }}
              >
                {url.length > 60 ? url.slice(0, 60) + "..." : url}
              </div>
            )}
          </div>
        </div>
      </AbsoluteFill>
      <Vignette intensity={0.4} />
    </BackgroundGradient>
  );
};
