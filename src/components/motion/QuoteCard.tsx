import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Quote } from "lucide-react";
import { LayoutRole } from "@/lib/types";
import { resolveDisplay, displayContainerStyle } from "./layoutContract";

export interface QuoteCardProps {
  quote?: string;
  emphasis?: string | null;
  author?: string | null;
  durationInFrames?: number;
  text?: string;
  layoutRole?: LayoutRole;
  /** @deprecated use layoutRole */
  mode?: "overlay" | "takeover";
  /** @deprecated use layoutRole */
  display_mode?: "overlay" | "takeover";
}

/** LayoutRoles this component knows how to render. */
export const QUOTE_CARD_SUPPORTED_ROLES: LayoutRole[] = [
  "full",
  "takeover",
  "overlay-lower-third",
];

export function QuoteCard({
  quote,
  emphasis,
  author = "Historic Transmission",
  durationInFrames,
  text,
  layoutRole,
  mode,
  display_mode,
}: QuoteCardProps) {
  const content = quote || text || "That's one small step for man... one giant leap for mankind.";
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

  const opacity = entranceOpacity * exitOpacity;
  const scale = entranceSpring * exitScale;
  const translateY = entranceTranslateY + exitTranslateY;

  // Frame-driven audio waveform bars
  const barsCount = 20;

  // Highlight emphasized text
  const renderFormattedQuote = () => {
    if (!emphasis || !content.toLowerCase().includes(emphasis.toLowerCase())) {
      return <span>&ldquo;{content}&rdquo;</span>;
    }

    const regex = new RegExp(`(${emphasis})`, "i");
    const parts = content.split(regex);
    return (
      <span>
        &ldquo;
        {parts.map((part, i) =>
          part.toLowerCase() === emphasis.toLowerCase() ? (
            <span
              key={i}
              style={{
                color: "#38bdf8",
                fontWeight: "bold",
                textShadow: "0 0 20px rgba(56, 189, 248, 0.6)",
              }}
            >
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
        &rdquo;
      </span>
    );
  };

  // ---------------------------------------------------------------------------
  // OVERLAY MODE (Lower-Third docked over Footage)
  // ---------------------------------------------------------------------------
  if (effectiveMode === "overlay") {
    return (
      <AbsoluteFill style={displayContainerStyle("overlay")}>
        <div
          style={{
            position: "absolute",
            bottom: 50,
            left: 64,
            maxWidth: 720,
            width: "calc(100% - 128px)",
            opacity,
            scale: `${scale}`,
            translate: `0px ${translateY}px`,
            transformOrigin: "bottom left",
            backgroundColor: "rgba(10, 15, 29, 0.84)",
            backdropFilter: "blur(20px)",
            borderRadius: 24,
            borderLeft: "6px solid #f59e0b",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(245, 158, 11, 0.15)",
            padding: "24px 32px",
            color: "#ffffff",
          }}
        >
          {/* Top Audio Oscilloscope & Transmission Badge */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  backgroundColor: "rgba(245, 158, 11, 0.2)",
                  border: "1px solid rgba(245, 158, 11, 0.5)",
                  fontSize: 11,
                  fontFamily: "monospace",
                  fontWeight: "bold",
                  letterSpacing: 2,
                  color: "#f59e0b",
                }}
              >
                LIVE TRANSMISSION
              </div>
              {author && (
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, color: "#94a3b8" }}>
                  — {author.toUpperCase()}
                </div>
              )}
            </div>

            {/* Audio Waveform Oscilloscope */}
            <div style={{ display: "flex", alignItems: "center", gap: 3, height: 24 }}>
              {Array.from({ length: barsCount }).map((_, idx) => {
                const wave = Math.sin(frame * 0.25 + idx * 0.4);
                const barH = Math.max(4, Math.abs(wave) * 20);
                return (
                  <div
                    key={idx}
                    style={{
                      width: 3,
                      height: `${barH}px`,
                      borderRadius: 2,
                      backgroundColor: "#f59e0b",
                      opacity: 0.8,
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Quote Body */}
          <blockquote
            style={{
              fontSize: 24,
              fontWeight: 700,
              fontStyle: "italic",
              lineHeight: 1.4,
              color: "#f8fafc",
            }}
          >
            {renderFormattedQuote()}
          </blockquote>
        </div>
      </AbsoluteFill>
    );
  }

  // ---------------------------------------------------------------------------
  // TAKEOVER MODE (Full-Screen Hero Quote)
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
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245, 158, 11, 0.2) 0%, rgba(147, 51, 234, 0.1) 45%, transparent 70%)",
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
          maxWidth: 900,
          width: "90%",
          padding: "48px 56px",
          borderRadius: 32,
          backgroundColor: "rgba(15, 23, 42, 0.85)",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.7), 0 0 50px rgba(245, 158, 11, 0.15)",
          backdropFilter: "blur(24px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            padding: 16,
            borderRadius: "50%",
            backgroundColor: "rgba(245, 158, 11, 0.15)",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            color: "#f59e0b",
            marginBottom: 24,
          }}
        >
          <Quote size={28} />
        </div>

        <blockquote
          style={{
            fontSize: 34,
            fontWeight: 700,
            lineHeight: 1.4,
            color: "#ffffff",
            fontStyle: "italic",
          }}
        >
          {renderFormattedQuote()}
        </blockquote>

        {author && (
          <div
            style={{
              marginTop: 24,
              fontSize: 14,
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: 3,
              color: "#f59e0b",
              textTransform: "uppercase",
            }}
          >
            — {author}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}
