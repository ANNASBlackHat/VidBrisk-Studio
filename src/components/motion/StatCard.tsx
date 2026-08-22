import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Sparkles, TrendingUp, Activity, PieChart } from "lucide-react";

export interface StatCardProps {
  value?: string;
  label?: string;
  visualType?: "ring" | "bar";
  durationInFrames?: number;
  subtext?: string | null;
  themeColor?: string;
  text?: string;
}

export function StatCard({
  value,
  label = "Statistical Highlight",
  visualType,
  durationInFrames,
  subtext = "Representing key metrics and project scale",
  themeColor = "#3b82f6",
  text,
}: StatCardProps) {
  const frame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const fps = videoConfig.fps;

  // Determine total assigned duration in frames
  const totalFrames = Math.max(
    30,
    durationInFrames || videoConfig.durationInFrames || 150
  );

  // If value is missing, extract from text (e.g. "$25B" or "4%" or "25 BILLION")
  const extracted = text?.match(
    /(\$?\d+(?:\.\d+)?\s*(?:billion|million|thousand|percent|%|k|m|b)?|\d+%)/i
  )?.[0];
  const rawValue = (value || extracted || "$25B").toUpperCase();

  const rawLabel = label || text?.slice(0, 45) || "Statistical Highlight";

  // Infer visualType if not explicitly passed ("ring" for percentages/ratios, "bar" for values/currencies)
  const effectiveVisualType: "ring" | "bar" =
    visualType ||
    (rawValue.includes("%") || rawLabel.toLowerCase().includes("percent") || rawLabel.toLowerCase().includes("share")
      ? "ring"
      : "bar");

  // Parse numeric part for animated counter
  const numMatch = rawValue.match(/(\d+(?:\.\d+)?)/);
  const targetNum = numMatch ? parseFloat(numMatch[1]) : 25;
  const prefix = rawValue.startsWith("$") ? "$" : "";
  const suffix = rawValue.replace(/^\$/, "").replace(/^[\d.]+/, "").trim();

  // Parse target ratio for visual metaphor (e.g., 75% -> 0.75, or scaled to [0.15, 0.9])
  const targetRatio = rawValue.includes("%")
    ? Math.min(1, Math.max(0.05, targetNum / 100))
    : 0.78;

  // --- Choreography Phase Timing ---
  const entranceEnd = Math.floor(totalFrames * 0.15);
  const countStart = Math.floor(totalFrames * 0.08);
  const countEnd = Math.floor(totalFrames * 0.52);
  const visualStart = Math.floor(totalFrames * 0.12);
  const visualEnd = Math.floor(totalFrames * 0.58);
  const exitStart = Math.floor(totalFrames * 0.88);

  // 1. Entrance Animation (Spring + Interpolation)
  const entranceSpring = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 90 },
  });

  const entranceOpacity = interpolate(frame, [0, Math.max(1, entranceEnd)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const entranceTranslateY = interpolate(frame, [0, Math.max(1, entranceEnd)], [28, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 2. Soft Exit Animation (last ~12% of duration)
  const exitProgress = interpolate(frame, [exitStart, totalFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = 1 - exitProgress;
  const exitScale = interpolate(exitProgress, [0, 1], [1, 0.94]);
  const exitTranslateY = interpolate(exitProgress, [0, 1], [0, -15]);

  // Overall card transform & opacity combining entrance and soft exit
  const cardOpacity = entranceOpacity * exitOpacity;
  const cardScale = entranceSpring * exitScale;
  const cardTranslateY = entranceTranslateY + exitTranslateY;

  // 3. Count-up Animation across first ~50% duration with smooth ease-out
  const countProgress = interpolate(frame, [countStart, countEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3), // cubic ease-out
  });

  const currentCount = Math.floor(countProgress * targetNum);
  const formattedValue = numMatch
    ? `${prefix}${currentCount}${suffix ? ` ${suffix}` : ""}`
    : rawValue;

  // 4. Secondary Visual Metaphor Animation (Radial Ring or Ascending Bar)
  const metaphorProgress = interpolate(frame, [visualStart, visualEnd], [0, targetRatio], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 2.5),
  });

  // 5. Continuous Frame-driven Ambient Motion (pure mathematical oscillation, zero CSS keyframes)
  const pulse = Math.sin((frame * Math.PI * 2) / 90);
  const subtleGlow = 0.35 + Math.sin((frame * Math.PI * 2) / 60) * 0.08;
  const iconPulse = 0.85 + Math.sin((frame * Math.PI * 2) / 45) * 0.15;

  // Ring circumference for SVG circle (r = 44)
  const ringRadius = 44;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringStrokeOffset = ringCircumference * (1 - metaphorProgress);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#060913",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Background Grid Pattern */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, #3b82f6 1px, transparent 1px), linear-gradient(to bottom, #3b82f6 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Dynamic Radial Glow Orbs (Frame-interpolated) */}
      <div
        className="absolute w-[650px] h-[650px] rounded-full blur-[140px] pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${themeColor} 0%, rgba(99, 102, 241, 0.4) 40%, transparent 70%)`,
          opacity: subtleGlow,
          transform: `scale(${1 + pulse * 0.03})`,
        }}
      />
      <div
        className="absolute w-[350px] h-[350px] rounded-full blur-[100px] pointer-events-none"
        style={{
          background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)",
          opacity: 0.25 + pulse * 0.05,
          transform: `translate(${pulse * 8}px, ${-pulse * 8}px)`,
        }}
      />

      {/* Main Glassmorphic Hero Card */}
      <div
        style={{
          transform: `scale(${cardScale}) translateY(${cardTranslateY}px)`,
          opacity: cardOpacity,
        }}
        className="relative z-10 flex flex-col items-center text-center max-w-2xl w-full mx-6 p-8 sm:p-12 rounded-3xl bg-slate-900/85 border border-blue-500/30 shadow-[0_0_80px_rgba(59,130,246,0.22)] backdrop-blur-2xl"
      >
        {/* Top Tagline Badge */}
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/90 border border-blue-700/60 text-blue-300 text-xs sm:text-sm font-mono uppercase tracking-widest mb-4 shadow-inner">
          {effectiveVisualType === "ring" ? (
            <PieChart className="w-4 h-4 text-cyan-400" />
          ) : (
            <TrendingUp className="w-4 h-4 text-blue-400" />
          )}
          <span>{rawLabel}</span>
        </div>

        {/* Central Display: Count-Up Stat + Secondary Visual Metaphor */}
        <div className="flex flex-col items-center justify-center w-full my-2">
          {effectiveVisualType === "ring" ? (
            <div className="relative flex items-center justify-center my-2">
              {/* Radial Progress Ring SVG */}
              <svg width="210" height="210" className="rotate-[-90deg]">
                <circle
                  cx="105"
                  cy="105"
                  r={ringRadius}
                  stroke="rgba(30, 41, 59, 0.7)"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="105"
                  cy="105"
                  r={ringRadius}
                  stroke="url(#ringGradient)"
                  strokeWidth="9"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringStrokeOffset}
                  strokeLinecap="round"
                  fill="transparent"
                  style={{
                    filter: "drop-shadow(0 0 8px rgba(6, 182, 212, 0.6))",
                  }}
                />
                <defs>
                  <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Number centered inside radial ring */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl sm:text-5xl font-black tracking-tight font-mono bg-gradient-to-r from-white via-blue-100 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(59,130,246,0.6)]">
                  {formattedValue}
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* Giant Hero Stat Number */}
              <div className="text-7xl sm:text-8xl md:text-9xl font-black tracking-tight font-mono my-1 bg-gradient-to-r from-white via-blue-100 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(59,130,246,0.6)]">
                {formattedValue}
              </div>

              {/* Ascending Progress Bar Element */}
              <div className="w-full max-w-md h-3.5 bg-slate-950 rounded-full border border-blue-900/60 p-0.5 mt-4 overflow-hidden shadow-inner relative">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-300 transition-none"
                  style={{
                    width: `${metaphorProgress * 100}%`,
                    boxShadow: "0 0 12px rgba(6, 182, 212, 0.7)",
                  }}
                />
              </div>
            </>
          )}
        </div>

        {/* Subtext Explanation */}
        {subtext && (
          <p className="text-sm sm:text-base text-slate-300 max-w-lg mt-4 font-sans leading-relaxed text-center font-normal">
            {subtext}
          </p>
        )}

        {/* Tech Accent Indicator Lines (Pure frame-driven pulse, zero CSS keyframes) */}
        <div className="flex items-center gap-2 mt-6">
          <div className="w-12 h-1 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
          <div style={{ transform: `scale(${iconPulse})`, opacity: iconPulse }}>
            {effectiveVisualType === "ring" ? (
              <Sparkles className="w-4 h-4 text-cyan-400" />
            ) : (
              <Activity className="w-4 h-4 text-cyan-400" />
            )}
          </div>
          <div className="w-12 h-1 rounded-full bg-gradient-to-l from-blue-500 to-cyan-400" />
        </div>
      </div>
    </AbsoluteFill>
  );
}
