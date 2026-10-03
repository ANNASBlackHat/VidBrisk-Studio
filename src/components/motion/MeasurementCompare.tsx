import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { LayoutRole } from "@/lib/types";
import { resolveDisplay, displayContainerStyle } from "./layoutContract";

export interface MeasurementStep {
  label: string;
  value: string;
}

export interface MeasurementCompareProps {
  title?: string;
  steps?: MeasurementStep[];
  comparisonType?: "shrinkage" | "dispute" | "scale" | string;
  durationInFrames?: number;
  text?: string;
  layoutRole?: LayoutRole;
  mode?: "overlay" | "takeover";
  display_mode?: "overlay" | "takeover";
}

export const MEASUREMENT_COMPARE_SUPPORTED_ROLES: LayoutRole[] = [
  "full",
  "takeover",
  "overlay-lower-third",
];

export function MeasurementCompare({
  title = "SPECIMEN MEASUREMENT COLLAPSE",
  steps = [
    { label: "Reported in water", value: "19 ft" },
    { label: "Freshly measured", value: "17 ft" },
    { label: "Preserved in alcohol", value: "13 ft 1 in" },
  ],
  comparisonType = "shrinkage",
  durationInFrames,
  text,
  layoutRole,
  mode,
  display_mode,
}: MeasurementCompareProps) {
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
        <div className="max-w-4xl w-full border border-[#2e3440] bg-[#11141b] rounded-sm p-10 shadow-2xl flex flex-col items-center">
          <div className="text-[11px] font-mono tracking-[0.35em] text-[#88c0d0] uppercase mb-4 opacity-80 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#88c0d0]" />
            {title}
          </div>

          <div className="text-sm font-sans text-[#d8dee9] opacity-70 mb-10 text-center max-w-md">
            Verifiable physical changes and recording artifacts over time
          </div>

          {/* Sequential Step Progression */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 w-full mb-8">
            {steps.map((step, idx) => {
              const stepDelay = 15 + idx * 20;
              const stepSpring = spring({
                frame: Math.max(0, frame - stepDelay),
                fps,
                config: { damping: 14, mass: 0.8, stiffness: 100 },
              });

              return (
                <React.Fragment key={idx}>
                  <div
                    className="flex-1 border border-[#3b4252] bg-[#1a1f2c] rounded p-6 text-center shadow-lg relative min-w-[180px]"
                    style={{
                      transform: `scale(${stepSpring})`,
                      opacity: interpolate(stepSpring, [0, 1], [0, 1]),
                    }}
                  >
                    <span className="text-[10px] font-mono tracking-widest text-[#88c0d0] uppercase block mb-2 opacity-75">
                      {step.label}
                    </span>
                    <div className="font-mono text-3xl font-extrabold text-[#eceff4] tracking-tight">
                      {step.value}
                    </div>
                  </div>

                  {idx < steps.length - 1 && (
                    <div className="hidden md:flex text-[#88c0d0] text-xl font-bold opacity-60">
                      →
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {comparisonType === "shrinkage" && (
            <div className="border-t border-[#2e3440] pt-4 text-center text-xs font-mono text-[#d8dee9] opacity-60">
              PHYSICAL DESICCATION & SHRINKAGE FACTOR: ~31% REDUCTION
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
}
