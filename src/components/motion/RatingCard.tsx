import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { LayoutRole } from "@/lib/types";
import { resolveDisplay, displayContainerStyle } from "./layoutContract";

export interface RatingCardProps {
  rating?: "CONFIRMED" | "PROBABLE" | "POSSIBLE" | "UNSUPPORTED" | "DISPROVEN" | string;
  claim?: string;
  test?: string;
  chapter?: string | null;
  durationInFrames?: number;
  text?: string;
  layoutRole?: LayoutRole;
  mode?: "overlay" | "takeover";
  display_mode?: "overlay" | "takeover";
}

export const RATING_CARD_SUPPORTED_ROLES: LayoutRole[] = [
  "full",
  "takeover",
  "overlay-lower-third",
];

const RATING_CONFIGS: Record<
  string,
  { bg: string; border: string; text: string; label: string; defaultTest: string }
> = {
  CONFIRMED: {
    bg: "rgba(16, 185, 129, 0.15)",
    border: "#10b981",
    text: "#34d399",
    label: "CONFIRMED",
    defaultTest: "Primary sources document it and do not contradict each other",
  },
  PROBABLE: {
    bg: "rgba(6, 182, 212, 0.15)",
    border: "#06b6d4",
    text: "#22d3ee",
    label: "PROBABLE",
    defaultTest: "The core is supported, but credible details conflict",
  },
  POSSIBLE: {
    bg: "rgba(245, 158, 11, 0.15)",
    border: "#f59e0b",
    text: "#fbbf24",
    label: "POSSIBLE",
    defaultTest: "It could have happened and nothing rules it out",
  },
  UNSUPPORTED: {
    bg: "rgba(148, 163, 184, 0.15)",
    border: "#94a3b8",
    text: "#cbd5e1",
    label: "UNSUPPORTED",
    defaultTest: "No credible evidence backs it",
  },
  DISPROVEN: {
    bg: "rgba(239, 68, 68, 0.15)",
    border: "#ef4444",
    text: "#f87171",
    label: "DISPROVEN",
    defaultTest: "The evidence contradicts it",
  },
};

export function RatingCard({
  rating = "UNSUPPORTED",
  claim,
  test,
  chapter,
  durationInFrames,
  text,
  layoutRole,
  mode,
  display_mode,
}: RatingCardProps) {
  const frame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const fps = videoConfig.fps;
  const effectiveMode = resolveDisplay({ layoutRole, mode, display_mode });

  const totalFrames = Math.max(
    30,
    durationInFrames || videoConfig.durationInFrames || 150
  );

  const entranceEnd = Math.floor(totalFrames * 0.12);
  const exitStart = Math.floor(totalFrames * 0.88);

  const opacity = interpolate(
    frame,
    [0, entranceEnd, exitStart, totalFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Badge slam / spring entrance
  const badgeScale = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 12, mass: 0.7, stiffness: 120 },
  });

  const upperRating = (rating || "UNSUPPORTED").toUpperCase();
  const config = RATING_CONFIGS[upperRating] || RATING_CONFIGS.UNSUPPORTED;
  const displayClaim = claim || text || "Historical Claim Under Investigation";
  const displayTest = test || config.defaultTest;

  return (
    <AbsoluteFill
      style={{
        ...displayContainerStyle(effectiveMode),
        opacity,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif",
      }}
    >
      <div className="absolute inset-0 bg-[#090b0e] bg-opacity-90 backdrop-blur-sm flex flex-col items-center justify-center p-8">
        {/* Card Boundary */}
        <div className="max-w-3xl w-full border border-[#2e3440] bg-[#11141b] rounded-sm p-10 relative shadow-2xl flex flex-col items-center text-center">
          {/* Top Label */}
          <div className="text-[11px] font-mono tracking-[0.35em] text-[#88c0d0] uppercase mb-6 opacity-80 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#88c0d0]" />
            DEAD RECKONING EVIDENCE RATING
            {chapter && <span>· CHAPTER {chapter}</span>}
          </div>

          {/* Investigated Claim */}
          <h2 className="text-2xl md:text-3xl font-serif text-[#eceff4] tracking-wide mb-8 max-w-xl leading-snug">
            "{displayClaim}"
          </h2>

          {/* Slamming Rating Badge */}
          <div
            className="px-8 py-3 rounded border-2 font-mono font-black text-xl tracking-[0.25em] shadow-lg mb-8 uppercase"
            style={{
              backgroundColor: config.bg,
              borderColor: config.border,
              color: config.text,
              transform: `scale(${badgeScale})`,
            }}
          >
            {config.label}
          </div>

          {/* Sourcing / Evidentiary Test Definition */}
          <div className="border-t border-[#2e3440] pt-6 max-w-lg w-full">
            <span className="text-[10px] font-mono tracking-[0.2em] text-[#d8dee9] opacity-50 uppercase block mb-1">
              THE EVIDENTIARY TEST
            </span>
            <p className="text-sm font-sans text-[#d8dee9] opacity-80 italic">
              {displayTest}
            </p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
