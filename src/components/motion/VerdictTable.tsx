import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { LayoutRole } from "@/lib/types";
import { resolveDisplay, displayContainerStyle } from "./layoutContract";

export interface VerdictClaim {
  claim: string;
  rating: string;
}

export interface VerdictTableProps {
  title?: string;
  claims?: VerdictClaim[];
  durationInFrames?: number;
  text?: string;
  layoutRole?: LayoutRole;
  mode?: "overlay" | "takeover";
  display_mode?: "overlay" | "takeover";
}

export const VERDICT_TABLE_SUPPORTED_ROLES: LayoutRole[] = [
  "full",
  "takeover",
  "overlay-lower-third",
];

const DEFAULT_CLAIMS: VerdictClaim[] = [
  { claim: "Giant squid exists", rating: "CONFIRMED" },
  { claim: "Ship encountered a giant squid (Alecton)", rating: "CONFIRMED" },
  { claim: "Squid attacked the ship (Alecton)", rating: "UNSUPPORTED" },
  { claim: "Squid attacked a boat (Portugal Cove, 1873)", rating: "PROBABLE" },
  { claim: "Large squid in the Bay of Bengal (1874)", rating: "POSSIBLE" },
  { claim: "Schooner Pearl sunk by a squid", rating: "UNSUPPORTED" },
  { claim: "Pearl account fabricated from scratch", rating: "POSSIBLE" },
  { claim: "Pearl is a garbled transmission of Alecton", rating: "POSSIBLE" },
];

const BADGE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  CONFIRMED: { bg: "rgba(16, 185, 129, 0.2)", border: "#10b981", text: "#34d399" },
  PROBABLE: { bg: "rgba(6, 182, 212, 0.2)", border: "#06b6d4", text: "#22d3ee" },
  POSSIBLE: { bg: "rgba(245, 158, 11, 0.2)", border: "#f59e0b", text: "#fbbf24" },
  UNSUPPORTED: { bg: "rgba(148, 163, 184, 0.2)", border: "#94a3b8", text: "#cbd5e1" },
  DISPROVEN: { bg: "rgba(239, 68, 68, 0.2)", border: "#ef4444", text: "#f87171" },
};

export function VerdictTable({
  title = "DEAD RECKONING — INVESTIGATIVE VERDICT",
  claims = DEFAULT_CLAIMS,
  durationInFrames,
  text,
  layoutRole,
  mode,
  display_mode,
}: VerdictTableProps) {
  const frame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const fps = videoConfig.fps;
  const effectiveMode = resolveDisplay({ layoutRole, mode, display_mode });

  const totalFrames = Math.max(
    30,
    durationInFrames || videoConfig.durationInFrames || 180
  );

  const entranceEnd = Math.floor(totalFrames * 0.1);
  const exitStart = Math.floor(totalFrames * 0.9);

  const opacity = interpolate(
    frame,
    [0, entranceEnd, exitStart, totalFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

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
      <div className="absolute inset-0 bg-[#090b0e] bg-opacity-95 flex flex-col items-center justify-center p-8">
        <div className="max-w-4xl w-full border border-[#2e3440] bg-[#11141b] rounded-sm p-8 shadow-2xl flex flex-col items-center">
          <div className="text-[11px] font-mono tracking-[0.35em] text-[#88c0d0] uppercase mb-6 opacity-80 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#88c0d0]" />
            {title}
          </div>

          {/* Table Container */}
          <div className="w-full border-t border-b border-[#2e3440] divide-y divide-[#2e3440] mb-6">
            {claims.map((item, idx) => {
              const rowDelay = 8 + idx * 8;
              const rowSpring = spring({
                frame: Math.max(0, frame - rowDelay),
                fps,
                config: { damping: 14, mass: 0.7, stiffness: 110 },
              });

              const rUpper = (item.rating || "UNSUPPORTED").toUpperCase();
              const colors = BADGE_COLORS[rUpper] || BADGE_COLORS.UNSUPPORTED;

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2.5 px-3 transition-all"
                  style={{
                    opacity: interpolate(rowSpring, [0, 1], [0, 1]),
                    transform: `translateY(${interpolate(rowSpring, [0, 1], [10, 0])}px)`,
                  }}
                >
                  <span className="text-sm md:text-base font-serif text-[#eceff4] tracking-wide">
                    {item.claim}
                  </span>
                  <span
                    className="font-mono text-xs font-bold px-3 py-1 rounded border tracking-widest uppercase ml-4"
                    style={{
                      backgroundColor: colors.bg,
                      borderColor: colors.border,
                      color: colors.text,
                    }}
                  >
                    {rUpper}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="text-[10px] font-mono tracking-widest text-[#d8dee9] opacity-50 uppercase">
            EVERY CLAIM RECEIVES A FORENSIC RATING · DEAD RECKONING
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
