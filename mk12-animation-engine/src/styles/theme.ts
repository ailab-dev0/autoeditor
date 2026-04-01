// ─── MK-12 Brand Theme ──────────────────────────────────────────────────────
// Matches the EditorLens MK-12 dashboard design system.

export const MK12_COLORS = {
  // Core palette
  background: "#0a0a0a",
  backgroundElevated: "#1a1a1a",
  foreground: "#ffffff",
  primary: "#0B84F3",
  primaryHover: "#0a75d9",
  primaryForeground: "#ffffff",
  secondary: "#333333",
  secondaryForeground: "#ffffff",
  muted: "#111111",
  mutedForeground: "#888888",
  accent: "#2a2a2a",
  card: "#141414",
  border: "#333333",
  borderDim: "#222222",

  // Decision colors
  keep: "#27AE60",
  cut: "#E74C3C",
  trim: "#F1C40F",
  rearrange: "#3498DB",
  speedUp: "#9B59B6",
  review: "#E67E22",

  // Content mark type colors
  markAnimation: "#6366f1",  // indigo
  markStockVideo: "#10b981", // emerald
  markArticle: "#f59e0b",    // amber
  markAiImage: "#ec4899",    // pink
  markSpeaking: "#8b5cf6",   // violet
  markChapter: "#0ea5e9",    // sky

  // Gradient presets
  gradientPrimary: ["#0B84F3", "#6366f1"],
  gradientWarm: ["#f59e0b", "#ec4899"],
  gradientCool: ["#0ea5e9", "#6366f1"],
  gradientNature: ["#10b981", "#0ea5e9"],
  gradientDark: ["#1a1a1a", "#0a0a0a"],
} as const;

export const MK12_FONTS = {
  heading: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  body: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
} as const;

export const MK12_SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const MK12_TYPOGRAPHY = {
  display: { fontSize: 72, fontWeight: 800, lineHeight: 1.1, letterSpacing: -2 },
  h1: { fontSize: 56, fontWeight: 700, lineHeight: 1.15, letterSpacing: -1.5 },
  h2: { fontSize: 42, fontWeight: 700, lineHeight: 1.2, letterSpacing: -1 },
  h3: { fontSize: 32, fontWeight: 600, lineHeight: 1.25, letterSpacing: -0.5 },
  h4: { fontSize: 24, fontWeight: 600, lineHeight: 1.3, letterSpacing: 0 },
  body: { fontSize: 20, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 },
  bodyLarge: { fontSize: 24, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 },
  caption: { fontSize: 14, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0.5 },
  label: { fontSize: 12, fontWeight: 600, lineHeight: 1.3, letterSpacing: 1 },
} as const;

// Standard video dimensions
export const MK12_VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
  defaultDurationFrames: 150, // 5 seconds
} as const;
