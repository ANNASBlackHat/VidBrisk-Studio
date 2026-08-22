import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface SplitScreenProps {
  leftTitle?: string;
  leftContent?: string;
  rightTitle?: string;
  rightContent?: string;
  durationInFrames?: number;
  text?: string;
  mode?: "overlay" | "takeover";
  display_mode?: "overlay" | "takeover";
}

export function SplitScreen({
  leftTitle = "TRADITIONAL COST",
  leftContent = "Multi-day manual editing and animation cycles.",
  rightTitle = "REMOTION AUTOMATION",
  rightContent = "Deterministic, programmatic render in under 60 seconds.",
  durationInFrames,
  text,
  mode,
  display_mode,
}: SplitScreenProps) {
  const frame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const fps = videoConfig.fps;
  const effectiveMode = display_mode || mode || "overlay";

  const totalFrames = Math.max(
    30,
    durationInFrames || videoConfig.durationInFrames || 150
  );

  const leftSlide = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 95 },
  });

  const rightSlide = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 95 },
  });

  const exitStart = Math.floor(totalFrames * 0.88);
  const exitProgress = interpolate(frame, [exitStart, totalFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = 1 - exitProgress;
  const exitScale = interpolate(exitProgress, [0, 1], [1, 0.94]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: effectiveMode === "takeover" ? "#030712" : "transparent",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        padding: "0 64px",
      }}
    >
      <div
        style={{
          scale: `${exitScale}`,
          opacity: exitOpacity,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 32,
          maxWidth: 1100,
          width: "100%",
          zIndex: 10,
        }}
      >
        {/* Left Pane */}
        <div
          style={{
            translate: `${(1 - leftSlide) * -40}px 0`,
            opacity: leftSlide,
            padding: "36px 40px",
            borderRadius: 24,
            backgroundColor: "rgba(15, 23, 42, 0.84)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(148, 163, 184, 0.25)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            color: "#ffffff",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: 2,
              color: "#94a3b8",
              marginBottom: 12,
            }}
          >
            {leftTitle.toUpperCase()}
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.4, color: "#f1f5f9", margin: 0 }}>
            {leftContent}
          </p>
        </div>

        {/* Right Pane */}
        <div
          style={{
            translate: `${(1 - rightSlide) * 40}px 0`,
            opacity: rightSlide,
            padding: "36px 40px",
            borderRadius: 24,
            backgroundColor: "rgba(15, 23, 42, 0.84)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(56, 189, 248, 0.15)",
            color: "#ffffff",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: 2,
              color: "#38bdf8",
              marginBottom: 12,
            }}
          >
            {rightTitle.toUpperCase()}
          </div>
          <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.4, color: "#f8fafc", margin: 0 }}>
            {text || rightContent}
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
}
