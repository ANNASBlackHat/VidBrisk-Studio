import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { TrendingUp, PieChart } from "lucide-react";
import { LayoutRole } from "@/lib/types";
import { resolveDisplay, displayContainerStyle } from "./layoutContract";

export interface StatCardProps {
  value?: string;
  primary_value?: string;
  label?: string;
  kicker?: string;
  visualType?: "chart" | "ring" | "bar" | "hud";
  visual_type?: "chart" | "ring" | "bar" | "hud";
  durationInFrames?: number;
  subtext?: string | null;
  themeColor?: string;
  theme?: string;
  text?: string;
  layoutRole?: LayoutRole;
  /** @deprecated use layoutRole */
  mode?: "overlay" | "takeover" | "adaptive";
  /** @deprecated use layoutRole */
  display_mode?: "overlay" | "takeover";
  secondaryMetric?: { value: string; label: string };
  secondary_metric?: { value: string; label: string };
  chartData?: Array<{ label: string; value: number; highlight?: boolean }>;
}

/** LayoutRoles this component knows how to render. */
export const STAT_CARD_SUPPORTED_ROLES: LayoutRole[] = [
  "full",
  "takeover",
  "overlay-lower-third",
];

export function StatCard({
  value,
  primary_value,
  label,
  kicker,
  visualType,
  visual_type,
  durationInFrames,
  subtext,
  text,
  layoutRole,
  mode,
  display_mode,
  secondaryMetric,
  secondary_metric,
  chartData,
}: StatCardProps) {
  const frame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const fps = videoConfig.fps;

  const totalFrames = Math.max(
    30,
    durationInFrames || videoConfig.durationInFrames || 150
  );

  // Unify props from backend or frontend
  const rawValue = (primary_value || value || text?.match(/(\$?\d+(?:\.\d+)?\s*(?:billion|million|thousand|percent|%|k|m|b)?|\d+%)/i)?.[0] || "$25.4B").toUpperCase();
  const rawKicker = kicker || label || "STATISTICAL HIGHLIGHT";
  const rawSubtext = subtext || text || "Representing key metrics and historic scale";
  // "adaptive" is a legacy no-op — layoutRole decides when present
  const effectiveMode = resolveDisplay({
    layoutRole,
    mode: mode === "adaptive" ? undefined : mode,
    display_mode,
  });
  const effectiveSecondary = secondary_metric || secondaryMetric;

  // Determine visual type
  const effectiveVisualType: "chart" | "ring" | "bar" | "hud" =
    visual_type ||
    visualType ||
    (rawValue.includes("%") || rawKicker.toLowerCase().includes("percent") || rawKicker.toLowerCase().includes("share")
      ? "ring"
      : rawValue.includes("B") || rawValue.includes("$") || rawValue.includes("M")
      ? "chart"
      : "bar");

  // Parse numeric part for animated counter
  const numMatch = rawValue.match(/(\d+(?:\.\d+)?)/);
  const targetNum = numMatch ? parseFloat(numMatch[1]) : 25.4;
  const prefix = rawValue.startsWith("$") ? "$" : "";
  const suffix = rawValue.replace(/^\$/, "").replace(/^[\d.]+/, "").trim();

  // Target ratio for ring or bar
  const targetRatio = rawValue.includes("%")
    ? Math.min(1, Math.max(0.05, targetNum / 100))
    : 0.85;

  // Default multi-bar chart data if visualType === 'chart'
  const defaultBars = [
    { label: "'61", value: 18, highlight: false },
    { label: "'63", value: 42, highlight: false },
    { label: "'65", value: 75, highlight: false },
    { label: "'66", value: 100, highlight: true }, // Peak
    { label: "'68", value: 65, highlight: false },
    { label: "'69", value: 58, highlight: false },
  ];
  const bars = chartData && chartData.length > 0 ? chartData : defaultBars;

  // --- Choreography Phase Timing ---
  const entranceEnd = Math.floor(totalFrames * 0.15);
  const countStart = Math.floor(totalFrames * 0.08);
  const countEnd = Math.floor(totalFrames * 0.52);
  const visualStart = Math.floor(totalFrames * 0.12);
  const visualEnd = Math.floor(totalFrames * 0.58);
  const exitStart = Math.floor(totalFrames * 0.88);

  // 1. Entrance Spring
  const entranceSpring = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 95 },
  });

  const entranceOpacity = interpolate(frame, [0, Math.max(1, entranceEnd)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const entranceTranslateY = interpolate(frame, [0, Math.max(1, entranceEnd)], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 2. Soft Exit
  const exitProgress = interpolate(frame, [exitStart, totalFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = 1 - exitProgress;
  const exitScale = interpolate(exitProgress, [0, 1], [1, 0.94]);
  const exitTranslateY = interpolate(exitProgress, [0, 1], [0, -15]);

  const cardOpacity = entranceOpacity * exitOpacity;
  const cardScale = entranceSpring * exitScale;
  const cardTranslateY = entranceTranslateY + exitTranslateY;

  // 3. Count-up Animation
  const countProgress = interpolate(frame, [countStart, countEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const currentCount = (countProgress * targetNum).toFixed(targetNum % 1 !== 0 ? 1 : 0);
  const formattedValue = numMatch
    ? `${prefix}${currentCount}${suffix ? ` ${suffix}` : ""}`
    : rawValue;

  // 4. Progress Metaphor Animation
  const metaphorProgress = interpolate(frame, [visualStart, visualEnd], [0, targetRatio], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // 5. Pure mathematical frame-driven ambient oscillation
  const pulse = Math.sin((frame * Math.PI * 2) / 90);
  const subtleGlow = 0.4 + Math.sin((frame * Math.PI * 2) / 60) * 0.1;

  // SVG Ring calculation
  const ringRadius = 42;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringStrokeOffset = ringCircumference * (1 - metaphorProgress);

  // ---------------------------------------------------------------------------
  // OVERLAY MODE (Lower-Third / Side-Docked over Footage)
  // ---------------------------------------------------------------------------
  if (effectiveMode === "overlay") {
    return (
      <AbsoluteFill style={displayContainerStyle("overlay")}>
        {/* Docked Card in Lower Third / Left Quadrant */}
        <div
          style={{
            position: "absolute",
            bottom: 54,
            left: 64,
            maxWidth: 680,
            width: "calc(100% - 128px)",
            opacity: cardOpacity,
            scale: `${cardScale}`,
            translate: `0px ${cardTranslateY}px`,
            transformOrigin: "bottom left",
            backgroundColor: "rgba(10, 15, 29, 0.82)",
            backdropFilter: "blur(20px)",
            borderRadius: 24,
            border: "1px solid rgba(56, 189, 248, 0.35)",
            boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(56, 189, 248, 0.15)",
            padding: "24px 32px",
            color: "#ffffff",
          }}
        >
          {/* Top Kicker Badge */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 14px",
                borderRadius: 9999,
                backgroundColor: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                fontSize: 12,
                fontFamily: "monospace",
                fontWeight: 700,
                letterSpacing: 2,
                color: "#38bdf8",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  backgroundColor: "#38bdf8",
                  boxShadow: "0 0 8px #38bdf8",
                }}
              />
              {rawKicker}
            </div>

            {effectiveSecondary && (
              <div style={{ fontSize: 13, color: "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: "bold", color: "#f59e0b" }}>{effectiveSecondary.value}</span>
                <span>{effectiveSecondary.label}</span>
              </div>
            )}
          </div>

          {/* Core Stat & Secondary Chart row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
            <div>
              <div
                style={{
                  fontSize: 58,
                  fontWeight: 900,
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  letterSpacing: -1.5,
                  lineHeight: 1.05,
                  background: "linear-gradient(90deg, #ffffff 0%, #e0f2fe 50%, #38bdf8 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 25px rgba(56, 189, 248, 0.4))",
                }}
              >
                {formattedValue}
              </div>

              {rawSubtext && (
                <div style={{ fontSize: 15, color: "#cbd5e1", marginTop: 8, lineHeight: 1.4, maxWidth: 440 }}>
                  {rawSubtext}
                </div>
              )}
            </div>

            {/* Visual Metaphor on right of card */}
            {effectiveVisualType === "ring" ? (
              <div style={{ position: "relative", width: 100, height: 100, flexShrink: 0 }}>
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r={ringRadius} stroke="rgba(51, 65, 85, 0.8)" strokeWidth="8" fill="none" />
                  <circle
                    cx="50"
                    cy="50"
                    r={ringRadius}
                    stroke="#38bdf8"
                    strokeWidth="8"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringStrokeOffset}
                    strokeLinecap="round"
                    fill="none"
                    transform="rotate(-90 50 50)"
                    style={{ filter: "drop-shadow(0 0 8px rgba(56, 189, 248, 0.6))" }}
                  />
                </svg>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: "bold",
                    color: "#38bdf8",
                  }}
                >
                  {Math.round(metaphorProgress * 100)}%
                </div>
              </div>
            ) : effectiveVisualType === "chart" ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 8,
                  height: 70,
                  padding: "6px 12px",
                  backgroundColor: "rgba(15, 23, 42, 0.6)",
                  borderRadius: 12,
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  flexShrink: 0,
                }}
              >
                {bars.map((bar, idx) => {
                  const barAnim = interpolate(frame, [visualStart + idx * 4, visualEnd + idx * 4], [0, bar.value], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                  });
                  return (
                    <div key={bar.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 22 }}>
                      <div
                        style={{
                          width: 14,
                          height: `${barAnim * 0.45}px`,
                          borderRadius: "3px 3px 0 0",
                          background: bar.highlight
                            ? "linear-gradient(180deg, #f59e0b 0%, #d97706 100%)"
                            : "linear-gradient(180deg, #38bdf8 0%, #1e40af 100%)",
                          boxShadow: bar.highlight ? "0 0 10px rgba(245,158,11,0.6)" : "0 0 6px rgba(56,189,248,0.4)",
                        }}
                      />
                      <span style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>{bar.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ width: 140, flexShrink: 0 }}>
                <div style={{ height: 8, backgroundColor: "rgba(30, 41, 59, 0.8)", borderRadius: 9999, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${metaphorProgress * 100}%`,
                      background: "linear-gradient(90deg, #38bdf8 0%, #06b6d4 100%)",
                      boxShadow: "0 0 10px #38bdf8",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // ---------------------------------------------------------------------------
  // TAKEOVER MODE (Full-Screen Hero Infographic)
  // ---------------------------------------------------------------------------
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#030712",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Background Blueprint Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(to right, rgba(56, 189, 248, 0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(56, 189, 248, 0.07) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          pointerEvents: "none",
        }}
      />

      {/* Dynamic Radial Ambient Glow */}
      <div
        style={{
          position: "absolute",
          width: 750,
          height: 750,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, rgba(30, 58, 138, 0.15) 50%, transparent 75%)`,
          opacity: subtleGlow,
          scale: `${1 + pulse * 0.04}`,
          filter: "blur(90px)",
          pointerEvents: "none",
        }}
      />

      {/* Main Glassmorphic Hero Card */}
      <div
        style={{
          opacity: cardOpacity,
          scale: `${cardScale}`,
          translate: `0px ${cardTranslateY}px`,
          position: "relative",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          maxWidth: 920,
          width: "90%",
          padding: "48px 56px",
          borderRadius: 32,
          backgroundColor: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(56, 189, 248, 0.35)",
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.7), 0 0 50px rgba(56, 189, 248, 0.2)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Kicker Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 18px",
            borderRadius: 9999,
            backgroundColor: "rgba(30, 41, 59, 0.9)",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            fontSize: 13,
            fontFamily: "monospace",
            fontWeight: 700,
            letterSpacing: 3,
            color: "#38bdf8",
            marginBottom: 20,
          }}
        >
          {effectiveVisualType === "ring" ? <PieChart size={16} /> : <TrendingUp size={16} />}
          <span>{rawKicker}</span>
        </div>

        {/* Hero Number */}
        <div
          style={{
            fontSize: 84,
            fontWeight: 900,
            fontFamily: "system-ui, -apple-system, sans-serif",
            letterSpacing: -2,
            lineHeight: 1,
            background: "linear-gradient(90deg, #ffffff 0%, #e0f2fe 40%, #38bdf8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 35px rgba(56, 189, 248, 0.5))",
          }}
        >
          {formattedValue}
        </div>

        {/* Subtext */}
        {rawSubtext && (
          <div style={{ fontSize: 20, color: "#cbd5e1", marginTop: 16, lineHeight: 1.5, maxWidth: 640 }}>
            {rawSubtext}
          </div>
        )}

        {/* Visual Chart / Progress Bar */}
        {effectiveVisualType === "chart" ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              width: "100%",
              maxWidth: 520,
              height: 120,
              marginTop: 28,
              padding: "16px 24px",
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              borderRadius: 16,
              border: "1px solid rgba(148, 163, 184, 0.2)",
            }}
          >
            {bars.map((bar, idx) => {
              const barAnim = interpolate(frame, [visualStart + idx * 6, visualEnd + idx * 6], [0, bar.value], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              });
              return (
                <div key={bar.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 44 }}>
                  <div
                    style={{
                      width: 28,
                      height: `${barAnim * 0.75}px`,
                      borderRadius: "6px 6px 0 0",
                      background: bar.highlight
                        ? "linear-gradient(180deg, #f59e0b 0%, #d97706 100%)"
                        : "linear-gradient(180deg, #38bdf8 0%, #1e40af 100%)",
                      boxShadow: bar.highlight ? "0 0 16px rgba(245,158,11,0.6)" : "0 0 12px rgba(56,189,248,0.4)",
                    }}
                  />
                  <span style={{ fontSize: 12, color: "#94a3b8", marginTop: 6, fontWeight: 600 }}>{bar.label}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ width: "100%", maxWidth: 480, height: 12, backgroundColor: "rgba(30, 41, 59, 0.8)", borderRadius: 9999, overflow: "hidden", marginTop: 24 }}>
            <div
              style={{
                height: "100%",
                width: `${metaphorProgress * 100}%`,
                background: "linear-gradient(90deg, #38bdf8 0%, #06b6d4 100%)",
                boxShadow: "0 0 14px #38bdf8",
              }}
            />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}
