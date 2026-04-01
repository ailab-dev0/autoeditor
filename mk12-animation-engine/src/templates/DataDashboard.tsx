import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from "remotion";
import { MK12_COLORS, MK12_FONTS, MK12_TYPOGRAPHY, MK12_SPACING } from "../styles/theme";
import { BackgroundGradient, Vignette } from "../components/BackgroundGradient";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatItem {
  label: string;
  value: number;
  color: string;
}

export interface DataDashboardProps {
  stats: StatItem[];
  pedagogyScore: number;
  title: string;
}

// ─── Animated Counter ────────────────────────────────────────────────────────

const AnimatedCounter: React.FC<{
  value: number;
  progress: number;
  label: string;
  color: string;
  fontSize?: number;
}> = ({ value, progress, label, color, fontSize = 48 }) => {
  const displayValue = Math.round(value * Math.min(progress, 1));

  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontFamily: MK12_FONTS.mono,
          fontSize,
          fontWeight: 700,
          color,
          lineHeight: 1.1,
          textShadow: `0 0 20px ${color}44`,
        }}
      >
        {displayValue}
      </div>
      <div
        style={{
          fontFamily: MK12_FONTS.body,
          fontSize: 13,
          fontWeight: 500,
          color: MK12_COLORS.mutedForeground,
          marginTop: 4,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
    </div>
  );
};

// ─── Bar Chart ───────────────────────────────────────────────────────────────

const BarChart: React.FC<{
  stats: StatItem[];
  progress: number;
  width: number;
  height: number;
}> = ({ stats, progress, width, height }) => {
  const maxValue = Math.max(...stats.map((s) => s.value), 1);
  const barWidth = Math.min(60, (width - 40) / stats.length - 10);
  const totalBarsWidth = stats.length * (barWidth + 10) - 10;
  const offsetX = (width - totalBarsWidth) / 2;

  return (
    <div style={{ position: "relative", width, height }}>
      {stats.map((stat, i) => {
        const barHeight = (stat.value / maxValue) * (height - 40) * Math.min(progress, 1);
        const x = offsetX + i * (barWidth + 10);

        return (
          <React.Fragment key={stat.label}>
            {/* Bar */}
            <div
              style={{
                position: "absolute",
                left: x,
                bottom: 24,
                width: barWidth,
                height: barHeight,
                background: `linear-gradient(to top, ${stat.color}88, ${stat.color})`,
                borderRadius: "4px 4px 0 0",
                boxShadow: `0 0 10px ${stat.color}33`,
              }}
            />
            {/* Label */}
            <div
              style={{
                position: "absolute",
                left: x,
                bottom: 2,
                width: barWidth,
                textAlign: "center",
                fontFamily: MK12_FONTS.body,
                fontSize: 9,
                color: MK12_COLORS.mutedForeground,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {stat.label}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── Pie Chart ───────────────────────────────────────────────────────────────

const PieChart: React.FC<{
  stats: StatItem[];
  progress: number;
  size: number;
}> = ({ stats, progress, size }) => {
  const total = stats.reduce((s, item) => s + item.value, 0) || 1;
  const radius = size / 2 - 10;
  const centerX = size / 2;
  const centerY = size / 2;

  let startAngle = -Math.PI / 2;
  const visibleAngle = 2 * Math.PI * Math.min(progress, 1);

  const slices: React.ReactNode[] = [];

  for (let i = 0; i < stats.length; i++) {
    const stat = stats[i];
    const sliceAngle = (stat.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;

    // Only draw if we've animated to this point
    const drawnEnd = Math.min(endAngle, startAngle + visibleAngle - (startAngle + Math.PI / 2));
    if (drawnEnd <= startAngle) {
      startAngle = endAngle;
      continue;
    }

    const actualEnd = Math.min(endAngle, -Math.PI / 2 + visibleAngle);

    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(actualEnd);
    const y2 = centerY + radius * Math.sin(actualEnd);
    const largeArc = actualEnd - startAngle > Math.PI ? 1 : 0;

    const d = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      "Z",
    ].join(" ");

    slices.push(
      <path key={i} d={d} fill={stat.color} opacity={0.85} />,
    );

    startAngle = endAngle;
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices}
      {/* Center hole for donut effect */}
      <circle cx={centerX} cy={centerY} r={radius * 0.5} fill={MK12_COLORS.background} />
    </svg>
  );
};

// ─── Pedagogy Gauge ──────────────────────────────────────────────────────────

const PedagogyGauge: React.FC<{
  score: number;
  progress: number;
  size: number;
}> = ({ score, progress, size }) => {
  const radius = size / 2 - 16;
  const centerX = size / 2;
  const centerY = size / 2;
  const circumference = 2 * Math.PI * radius;
  const fillPercent = (score / 100) * Math.min(progress, 1);
  const strokeDashoffset = circumference * (1 - fillPercent);

  // Color from red to green based on score
  const hue = score * 1.2; // 0=red, 120=green
  const gaugeColor = `hsl(${hue}, 70%, 55%)`;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="none"
          stroke={MK12_COLORS.border}
          strokeWidth={8}
        />
        {/* Progress ring */}
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="none"
          stroke={gaugeColor}
          strokeWidth={8}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${centerX} ${centerY})`}
          style={{ filter: `drop-shadow(0 0 6px ${gaugeColor}66)` }}
        />
      </svg>
      {/* Center label */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: MK12_FONTS.mono,
            fontSize: 36,
            fontWeight: 700,
            color: gaugeColor,
          }}
        >
          {Math.round(score * Math.min(progress, 1))}
        </div>
        <div
          style={{
            fontFamily: MK12_FONTS.body,
            fontSize: 11,
            fontWeight: 500,
            color: MK12_COLORS.mutedForeground,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Pedagogy
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const DataDashboard: React.FC<DataDashboardProps> = ({
  stats,
  pedagogyScore,
  title,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Staggered entrance animations
  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  const counterProgress = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 25, stiffness: 40 },
  });

  const chartProgress = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 30, stiffness: 30 },
  });

  const gaugeProgress = spring({
    frame: Math.max(0, frame - 45),
    fps,
    config: { damping: 25, stiffness: 35 },
  });

  // Take first 4 stats for the counter row
  const counterStats = stats.slice(0, 4);
  // Use up to 8 stats for charts
  const chartStats = stats.slice(0, 8);

  return (
    <AbsoluteFill>
      <BackgroundGradient
        colorA="#0a0a0f"
        colorB="#111122"
        showGrid
      />

      {/* Title */}
      <Sequence from={0}>
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: MK12_FONTS.heading,
            ...MK12_TYPOGRAPHY.h3,
            color: MK12_COLORS.foreground,
            opacity: titleProgress,
            transform: `translateY(${interpolate(titleProgress, [0, 1], [20, 0])}px)`,
          }}
        >
          {title}
        </div>
      </Sequence>

      {/* Counter row */}
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 80,
          right: 80,
          display: "flex",
          justifyContent: "space-around",
          alignItems: "flex-start",
          opacity: interpolate(counterProgress, [0, 0.3, 1], [0, 1, 1]),
        }}
      >
        {counterStats.map((stat, i) => {
          const stagger = spring({
            frame: Math.max(0, frame - 15 - i * 5),
            fps,
            config: { damping: 25, stiffness: 40 },
          });

          return (
            <AnimatedCounter
              key={stat.label}
              value={stat.value}
              progress={stagger}
              label={stat.label}
              color={stat.color}
            />
          );
        })}
      </div>

      {/* Charts row */}
      <div
        style={{
          position: "absolute",
          top: 280,
          left: 60,
          right: 60,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 40,
        }}
      >
        {/* Bar chart */}
        <div
          style={{
            flex: 1,
            opacity: interpolate(chartProgress, [0, 0.2, 1], [0, 1, 1]),
            transform: `translateY(${interpolate(chartProgress, [0, 1], [30, 0])}px)`,
          }}
        >
          <div
            style={{
              fontFamily: MK12_FONTS.body,
              fontSize: 14,
              fontWeight: 600,
              color: MK12_COLORS.mutedForeground,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 12,
              textAlign: "center",
            }}
          >
            Segment Distribution
          </div>
          <BarChart
            stats={chartStats}
            progress={chartProgress}
            width={600}
            height={300}
          />
        </div>

        {/* Pie chart */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: interpolate(chartProgress, [0, 0.2, 1], [0, 1, 1]),
            transform: `translateY(${interpolate(chartProgress, [0, 1], [30, 0])}px)`,
          }}
        >
          <div
            style={{
              fontFamily: MK12_FONTS.body,
              fontSize: 14,
              fontWeight: 600,
              color: MK12_COLORS.mutedForeground,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            Composition
          </div>
          <PieChart
            stats={chartStats.slice(0, 5)}
            progress={chartProgress}
            size={240}
          />
        </div>

        {/* Pedagogy gauge */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: interpolate(gaugeProgress, [0, 0.2, 1], [0, 1, 1]),
            transform: `scale(${interpolate(gaugeProgress, [0, 1], [0.8, 1])})`,
          }}
        >
          <div
            style={{
              fontFamily: MK12_FONTS.body,
              fontSize: 14,
              fontWeight: 600,
              color: MK12_COLORS.mutedForeground,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            Quality Score
          </div>
          <PedagogyGauge
            score={pedagogyScore}
            progress={gaugeProgress}
            size={200}
          />
        </div>
      </div>

      {/* Legend row */}
      <div
        style={{
          position: "absolute",
          bottom: 50,
          left: 80,
          right: 80,
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: 20,
          opacity: interpolate(
            spring({ frame: Math.max(0, frame - 60), fps, config: { damping: 20 } }),
            [0, 1],
            [0, 1],
          ),
        }}
      >
        {chartStats.map((stat) => (
          <div
            key={stat.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: stat.color,
              }}
            />
            <span
              style={{
                fontFamily: MK12_FONTS.body,
                fontSize: 12,
                color: MK12_COLORS.mutedForeground,
              }}
            >
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      <Vignette />
    </AbsoluteFill>
  );
};
