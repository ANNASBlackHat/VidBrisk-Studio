import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { LayoutRole } from "@/lib/types";
import { resolveDisplay, displayContainerStyle } from "./layoutContract";

export interface ReprintNode {
  outlet: string;
  date?: string;
  location?: string;
}

export interface ReprintChainProps {
  title?: string;
  nodes?: ReprintNode[];
  durationInFrames?: number;
  text?: string;
  layoutRole?: LayoutRole;
  mode?: "overlay" | "takeover";
  display_mode?: "overlay" | "takeover";
}

export const REPRINT_CHAIN_SUPPORTED_ROLES: LayoutRole[] = [
  "full",
  "takeover",
  "overlay-lower-third",
];

const DEFAULT_NODES: ReprintNode[] = [
  { outlet: "Homeward Mail", date: "29 June 1874", location: "London" },
  { outlet: "The Times", date: "4 July 1874", location: "London" },
  { outlet: "News of the World", date: "5 July 1874", location: "London" },
  { outlet: "Sacramento Daily Union", date: "31 July 1874", location: "California" },
];

export function ReprintChain({
  title = "THE REPRINT PROPAGATION CHAIN",
  nodes = DEFAULT_NODES,
  durationInFrames,
  text,
  layoutRole,
  mode,
  display_mode,
}: ReprintChainProps) {
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
        <div className="max-w-5xl w-full border border-[#2e3440] bg-[#11141b] rounded-sm p-10 shadow-2xl flex flex-col items-center">
          <div className="text-[11px] font-mono tracking-[0.35em] text-[#88c0d0] uppercase mb-4 opacity-80 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#88c0d0]" />
            {title}
          </div>

          <p className="text-sm font-sans text-[#d8dee9] opacity-70 mb-10 text-center max-w-lg">
            Sequential text transmission across 19th-century periodicals: <span className="text-[#88c0d0] font-semibold">one single source, copied four times</span>
          </p>

          {/* Left-to-right Node Flow */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full mb-8">
            {nodes.map((node, idx) => {
              const nodeDelay = 10 + idx * 18;
              const nodeSpring = spring({
                frame: Math.max(0, frame - nodeDelay),
                fps,
                config: { damping: 14, mass: 0.8, stiffness: 100 },
              });

              return (
                <React.Fragment key={idx}>
                  <div
                    className="flex-1 border border-[#3b4252] bg-[#171c26] rounded p-5 text-center shadow-lg relative min-w-[160px]"
                    style={{
                      transform: `scale(${nodeSpring})`,
                      opacity: interpolate(nodeSpring, [0, 1], [0, 1]),
                    }}
                  >
                    <div className="text-[10px] font-mono tracking-widest text-[#88c0d0] opacity-80 uppercase mb-1">
                      {node.date || `STEP ${idx + 1}`}
                    </div>
                    <div className="font-serif text-base font-bold text-[#eceff4] mb-1">
                      {node.outlet}
                    </div>
                    {node.location && (
                      <div className="text-[11px] font-sans text-[#d8dee9] opacity-60">
                        {node.location}
                      </div>
                    )}
                  </div>

                  {idx < nodes.length - 1 && (
                    <div
                      className="text-[#88c0d0] font-bold text-lg hidden md:block opacity-60"
                      style={{
                        transform: `translateX(${interpolate(nodeSpring, [0, 1], [-10, 0])}px)`,
                      }}
                    >
                      →
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Non-independence Warning Footer */}
          <div className="border border-[#ef4444] bg-[#ef4444] bg-opacity-10 text-[#f87171] text-xs font-mono px-4 py-2 rounded uppercase tracking-wider">
            CRITICAL EVIDENTIARY RULE: REPRINTS DO NOT CONSTITUTE INDEPENDENT CORROBORATION
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
