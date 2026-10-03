import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { LayoutRole } from "@/lib/types";
import { resolveDisplay, displayContainerStyle } from "./layoutContract";

export interface SourcingCardProps {
  tier?: number;
  tierName?: "PRIMARY" | "SCIENTIFIC" | "SECONDARY" | "REPRINT" | string;
  source?: string;
  date?: string | null;
  isIndependent?: boolean;
  durationInFrames?: number;
  text?: string;
  layoutRole?: LayoutRole;
  mode?: "overlay" | "takeover";
  display_mode?: "overlay" | "takeover";
}

export const SOURCING_CARD_SUPPORTED_ROLES: LayoutRole[] = [
  "full",
  "takeover",
  "overlay-lower-third",
];

const TIERS = [
  { tier: 1, name: "PRIMARY", desc: "Contemporary document: newspaper of record, official report, letter" },
  { tier: 2, name: "SCIENTIFIC", desc: "Peer-reviewed work, museum records, taxonomic description" },
  { tier: 3, name: "SECONDARY", desc: "Later journalism, books, archives, biographies" },
  { tier: 4, name: "REPRINT", desc: "Text copied from another publication (Not independent)", hatched: true },
];

export function SourcingCard({
  tier = 1,
  tierName,
  source,
  date,
  isIndependent = true,
  durationInFrames,
  text,
  layoutRole,
  mode,
  display_mode,
}: SourcingCardProps) {
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

  // Active tier calculation
  let activeTierNum = tier;
  if (tierName) {
    const tUpper = tierName.toUpperCase();
    if (tUpper.includes("REPRINT") || tUpper.includes("4")) activeTierNum = 4;
    else if (tUpper.includes("SECONDARY") || tUpper.includes("3")) activeTierNum = 3;
    else if (tUpper.includes("SCIENTIFIC") || tUpper.includes("2")) activeTierNum = 2;
    else activeTierNum = 1;
  }

  const activeSpring = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 14, mass: 0.8, stiffness: 90 },
  });

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
      <div className="absolute inset-0 bg-[#090b0e] bg-opacity-90 flex flex-col items-center justify-center p-8">
        <div className="max-w-3xl w-full border border-[#2e3440] bg-[#11141b] rounded-sm p-8 shadow-2xl flex flex-col items-center">
          {/* Header */}
          <div className="text-[11px] font-mono tracking-[0.35em] text-[#88c0d0] uppercase mb-6 opacity-80 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#88c0d0]" />
            FOUR-TIER SOURCING HIERARCHY
          </div>

          {/* Tiers List */}
          <div className="w-full space-y-3 mb-8">
            {TIERS.map((t) => {
              const isActive = t.tier === activeTierNum;
              return (
                <div
                  key={t.tier}
                  className={`p-4 border rounded flex items-center justify-between transition-all duration-300 relative overflow-hidden ${
                    isActive
                      ? "border-[#88c0d0] bg-[#1c2331] shadow-md"
                      : "border-[#2e3440] bg-[#0d1017] opacity-60"
                  }`}
                  style={{
                    transform: isActive ? `scale(${1 + 0.02 * activeSpring})` : "scale(1)",
                  }}
                >
                  {/* Hatching for Tier 4 */}
                  {t.hatched && (
                    <div
                      className="absolute inset-0 opacity-15 pointer-events-none"
                      style={{
                        backgroundImage: "repeating-linear-gradient(45deg, #ef4444 0, #ef4444 2px, transparent 0, transparent 8px)",
                      }}
                    />
                  )}

                  <div className="flex items-center gap-4 relative z-10">
                    <span
                      className={`font-mono text-xs font-bold px-2.5 py-1 rounded ${
                        isActive
                          ? "bg-[#88c0d0] text-[#0f141c]"
                          : "bg-[#2e3440] text-[#d8dee9]"
                      }`}
                    >
                      TIER {t.tier}
                    </span>
                    <div>
                      <span className="font-mono tracking-widest text-sm text-[#eceff4] font-semibold uppercase">
                        {t.name}
                      </span>
                      <p className="text-xs font-sans text-[#d8dee9] opacity-70">
                        {t.desc}
                      </p>
                    </div>
                  </div>

                  {t.hatched && (
                    <span className="relative z-10 text-[10px] font-mono px-2 py-0.5 rounded border border-[#ef4444] text-[#f87171] uppercase tracking-wider font-semibold">
                      NOT INDEPENDENT
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active Source Highlight Footer */}
          {source && (
            <div className="w-full border-t border-[#2e3440] pt-4 text-center">
              <span className="text-[10px] font-mono tracking-widest text-[#88c0d0] uppercase block mb-1">
                EVALUATED SOURCE
              </span>
              <p className="text-base font-serif text-[#eceff4] italic">
                "{source}" {date && <span className="opacity-70 font-sans">({date})</span>}
              </p>
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
}
