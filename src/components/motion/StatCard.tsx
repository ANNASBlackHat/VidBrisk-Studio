import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Sparkles, TrendingUp } from "lucide-react";

export interface StatCardProps {
  value?: string;
  label?: string;
  subtext?: string | null;
  themeColor?: string;
  text?: string;
}

export function StatCard({
  value,
  label = "Total Project Investment",
  subtext = "Representing four percent of the federal budget",
  themeColor = "#3b82f6",
  text,
}: StatCardProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // If value is missing, extract from text (e.g. "$25B" or "25 BILLION")
  const rawValue = value || (text?.match(/(\$?\d+(?:\.\d+)?\s*(?:billion|million|thousand|percent|%|k|m|b)?|\d+%)/i)?.[0] ?? "$25B").toUpperCase();
  const rawLabel = label || text?.slice(0, 45) || "Statistical Highlight";

  // Parse numeric part for animated counter
  const numMatch = rawValue.match(/(\d+(?:\.\d+)?)/);
  const targetNum = numMatch ? parseFloat(numMatch[1]) : 25;
  const prefix = rawValue.startsWith("$") ? "$" : "";
  const suffix = rawValue.replace(/^\$/, "").replace(/^[\d.]+/, "").trim();

  // Count up animation with spring easing
  const countProgress = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 80 },
  });

  const currentCount = Math.floor(countProgress * targetNum);
  const formattedValue = numMatch
    ? `${prefix}${currentCount}${suffix ? ` ${suffix}` : ""}`
    : rawValue;

  // Card entrance animation
  const cardScale = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 100 },
  });

  const cardOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(frame, [0, 15], [30, 0], {
    extrapolateRight: "clamp",
  });

  // Ambient pulsing light
  const pulse = Math.sin(frame / 8) * 10;
  const rotation = Math.sin(frame / 20) * 2;

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

      {/* Dynamic Radial Glow Orbs */}
      <div
        className="absolute w-[650px] h-[650px] rounded-full blur-[140px] pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${themeColor} 0%, rgba(99, 102, 241, 0.4) 40%, transparent 70%)`,
          opacity: 0.45,
          transform: `scale(${1 + pulse * 0.02})`,
        }}
      />
      <div
        className="absolute w-[350px] h-[350px] rounded-full blur-[100px] pointer-events-none"
        style={{
          background: "radial-gradient(circle, #06b6d4 0%, transparent 70%)",
          opacity: 0.3,
          transform: `translate(${pulse * 2}px, ${-pulse * 2}px)`,
        }}
      />

      {/* Main Glassmorphic Hero Card */}
      <div
        style={{
          transform: `scale(${cardScale}) translateY(${translateY}px) rotate(${rotation * 0.3}deg)`,
          opacity: cardOpacity,
        }}
        className="relative z-10 flex flex-col items-center text-center max-w-2xl w-full mx-6 p-10 sm:p-14 rounded-3xl bg-slate-900/80 border border-blue-500/30 shadow-[0_0_80px_rgba(59,130,246,0.25)] backdrop-blur-2xl"
      >
        {/* Top Tagline Badge */}
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/90 border border-blue-700/60 text-blue-300 text-xs sm:text-sm font-mono uppercase tracking-widest mb-6 shadow-inner">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          <span>{rawLabel}</span>
        </div>

        {/* Giant Hero Stat Number */}
        <div className="text-7xl sm:text-8xl md:text-9xl font-black tracking-tight font-mono my-2 bg-gradient-to-r from-white via-blue-100 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(59,130,246,0.6)]">
          {formattedValue}
        </div>

        {/* Subtext Explanation */}
        {subtext && (
          <p className="text-base sm:text-lg text-slate-300 max-w-lg mt-4 font-sans leading-relaxed text-center font-normal">
            {subtext}
          </p>
        )}

        {/* Tech Accent Indicator Lines */}
        <div className="flex items-center gap-2 mt-8">
          <div className="w-12 h-1 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400" />
          <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
          <div className="w-12 h-1 rounded-full bg-gradient-to-l from-blue-500 to-cyan-400" />
        </div>
      </div>
    </AbsoluteFill>
  );
}
