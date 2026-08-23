import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { LayoutRole } from "@/lib/types";
import { resolveDisplay, displayContainerStyle } from "./layoutContract";

export interface StandardCardProps {
  text?: string;
  title?: string;
  durationInFrames?: number;
  layoutRole?: LayoutRole;
  /** @deprecated use layoutRole */
  mode?: "overlay" | "takeover";
  /** @deprecated use layoutRole */
  display_mode?: "overlay" | "takeover";
}

/** LayoutRoles this component knows how to render. */
export const STANDARD_CARD_SUPPORTED_ROLES: LayoutRole[] = [
  "full",
  "takeover",
  "overlay-lower-third",
  "corner-tl",
  "corner-tr",
  "corner-bl",
  "corner-br",
];

export function StandardCard({
  text = "Standard narration text card overlay.",
  title = "NARRATION OVERVIEW",
  durationInFrames,
  layoutRole,
  mode,
  display_mode,
}: StandardCardProps) {
  const frame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const fps = videoConfig.fps;
  const effectiveMode = resolveDisplay({ layoutRole, mode, display_mode });

  const totalFrames = Math.max(
    30,
    durationInFrames || videoConfig.durationInFrames || 150
  );

  const entranceEnd = Math.floor(totalFrames * 0.15);
  const exitStart = Math.floor(totalFrames * 0.88);

  const entranceSpring = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 95 },
  });

  const entranceOpacity = interpolate(frame, [0, Math.max(1, entranceEnd)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const entranceTranslateY = interpolate(frame, [0, Math.max(1, entranceEnd)], [25, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Soft exit
  const exitProgress = interpolate(frame, [exitStart, totalFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = 1 - exitProgress;
  const exitScale = interpolate(exitProgress, [0, 1], [1, 0.94]);
  const exitTranslateY = interpolate(exitProgress, [0, 1], [0, -15]);

  const scale = entranceSpring * exitScale;
  const opacity = entranceOpacity * exitOpacity;
  const translateY = entranceTranslateY + exitTranslateY;

  // ---------------------------------------------------------------------------
  // OVERLAY MODE (Docked Lower-Third Card) — transparent, click-through
  // ---------------------------------------------------------------------------
  if (effectiveMode === "overlay") {
    return (
      <AbsoluteFill style={displayContainerStyle("overlay")}>
        <div
          style={{
            position: "absolute",
            bottom: 50,
            left: 64,
            maxWidth: 700,
            width: "calc(100% - 128px)",
            opacity,
            scale: `${scale}`,
            translate: `0px ${translateY}px`,
            transformOrigin: "bottom left",
            backgroundColor: "rgba(10, 15, 29, 0.82)",
            backdropFilter: "blur(20px)",
            borderRadius: 20,
            border: "1px solid rgba(56, 189, 248, 0.35)",
            boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(56, 189, 248, 0.15)",
            padding: "22px 30px",
            color: "#ffffff",
          }}
        >
          {title && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 12px",
                borderRadius: 9999,
                backgroundColor: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                fontSize: 11,
                fontFamily: "monospace",
                fontWeight: 700,
                letterSpacing: 2,
                color: "#38bdf8",
                marginBottom: 10,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#38bdf8" }} />
              {title.toUpperCase()}
            </div>
          )}

          <p style={{ fontSize: 20, fontWeight: 600, color: "#f8fafc", lineHeight: 1.45, margin: 0 }}>
            {text}
          </p>
        </div>
      </AbsoluteFill>
    );
  }

  // ---------------------------------------------------------------------------
  // TAKEOVER MODE (Full-Screen Hero Card)
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
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(56, 189, 248, 0.2) 0%, transparent 70%)",
          filter: "blur(90px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          opacity,
          scale: `${scale}`,
          translate: `0px ${translateY}px`,
          position: "relative",
          zIndex: 10,
          maxWidth: 820,
          width: "85%",
          padding: "44px 52px",
          borderRadius: 28,
          backgroundColor: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.7), 0 0 40px rgba(56, 189, 248, 0.15)",
          backdropFilter: "blur(24px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {title && (
          <span
            style={{
              padding: "6px 16px",
              borderRadius: 9999,
              fontSize: 12,
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: 2,
              color: "#38bdf8",
              backgroundColor: "rgba(30, 41, 59, 0.9)",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              marginBottom: 16,
            }}
          >
            {title.toUpperCase()}
          </span>
        )}

        <p style={{ fontSize: 26, fontWeight: 600, color: "#f8fafc", lineHeight: 1.5, margin: 0 }}>
          {text}
        </p>
      </div>
    </AbsoluteFill>
  );
}
