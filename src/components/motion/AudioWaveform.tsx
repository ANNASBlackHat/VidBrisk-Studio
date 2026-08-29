/**
 * AudioWaveform — Reactive Audio Spectrum & Audiogram Card Component
 * Implements Step 2 of plan_advanced_remotion_capabilities.
 * 
 * Provides deterministic, frame-accurate multi-harmonic audio spectrum visualization
 * with peak decay meters, speaker attribution, and responsive layout contract support.
 * 
 * // TODO: Add support for live WebAudio FFT / @remotion/media-utils audioData hook
 */

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { LayoutRole } from "@/lib/types";
import { resolveDisplay, displayContainerStyle } from "./layoutContract";
import { Mic, Radio, Volume2, Activity } from "lucide-react";

export const AUDIO_WAVEFORM_SUPPORTED_ROLES: LayoutRole[] = [
  "takeover",
  "full",
  "overlay-lower-third",
  "corner-tl",
  "corner-tr",
  "corner-bl",
  "corner-br",
  "split-left",
  "split-right",
];

export interface AudioWaveformProps extends Record<string, unknown> {
  title?: string;
  speaker?: string;
  subtext?: string;
  quote?: string;
  themeColor?: string;
  barCount?: number;
  visualType?: "bars" | "wave" | "circular";
  durationInFrames?: number;
  layoutRole?: LayoutRole;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  title = "MISSION VOICE COMM",
  speaker = "APOLLO 11 ASTRONAUT",
  subtext = "TRANSMISSION FEED",
  quote,
  themeColor = "#10b981", // Emerald accent
  barCount = 36,
  visualType = "bars",
  durationInFrames: propDuration,
  layoutRole,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: videoDuration } = useVideoConfig();
  const duration = propDuration || videoDuration || 180;

  const display = resolveDisplay({ layoutRole });
  const isOverlay = display === "overlay";

  // Entrance spring
  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  // Calculate dynamic bar heights using human vocal harmonic profile + 2D noise
  const bars = Array.from({ length: barCount }, (_, i) => {
    // Human voice formant bell curve (stronger in mid frequencies)
    const normalizedPos = i / (barCount - 1);
    const formantWeight = Math.sin(normalizedPos * Math.PI) * 0.7 + 0.3;

    // Fast speech syllable noise oscillation
    const noiseVal = (noise2D(`audio-bar-${i}`, frame * 0.28, i * 0.15) + 1) / 2;

    // Harmonic pulse wave traveling across the frequencies
    const wave = Math.sin(frame * 0.2 - i * 0.3) * 0.15 + 0.15;

    // Combined amplitude (0.05 to 1.0)
    let amp = Math.min(1, Math.max(0.08, (noiseVal * 0.65 + wave * 0.35) * formantWeight * 1.3));

    // Natural speech pauses (dip amplitude every ~90 frames for breathing cadence)
    const breathPause = Math.sin((frame / 45) * Math.PI);
    if (breathPause < -0.6) {
      amp *= 0.25;
    }

    const heightPct = Math.round(amp * 100);

    // Floating peak indicator with slight lag/decay
    const peakNoise = (noise2D(`audio-peak-${i}`, (frame - 2) * 0.28, i * 0.15) + 1) / 2;
    const peakHeight = Math.min(100, Math.max(heightPct + 6, Math.round(peakNoise * formantWeight * 110)));

    return { heightPct, peakHeight };
  });

  // Overall vocal energy meter (used for pulsating mic glow)
  const globalEnergy =
    bars.reduce((acc, b) => acc + b.heightPct, 0) / (barCount * 100);
  const pulseScale = interpolate(globalEnergy, [0.1, 0.8], [1, 1.25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        ...displayContainerStyle(display),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isOverlay ? "1.5rem" : "3rem",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: isOverlay ? "1.25rem" : "2rem",
          overflow: "hidden",
          backgroundColor: isOverlay ? "rgba(10, 15, 29, 0.88)" : "#070b14",
          border: `1px solid ${isOverlay ? "rgba(16, 185, 129, 0.35)" : "#1e293b"}`,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
          backdropFilter: isOverlay ? "blur(12px)" : "none",
          transform: `scale(${enterSpring})`,
          opacity: enterSpring,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: isOverlay ? "1.5rem" : "2.5rem",
        }}
      >
        {/* Subtle grid background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.08) 0%, transparent 70%), linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
            backgroundSize: "100% 100%, 30px 30px, 30px 30px",
            pointerEvents: "none",
          }}
        />

        {/* Top Header & Speaker Telemetry */}
        <div style={{ position: "relative", zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <Radio style={{ width: 14, height: 14, color: themeColor }} />
              <span
                style={{
                  fontSize: "0.65rem",
                  fontFamily: "monospace",
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  color: themeColor,
                  textTransform: "uppercase",
                }}
              >
                {subtext}
              </span>
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: isOverlay ? "1.15rem" : "1.6rem",
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "-0.02em",
              }}
            >
              {speaker}
            </h2>
            <div
              style={{
                fontSize: "0.7rem",
                fontFamily: "monospace",
                color: "#94a3b8",
                marginTop: "0.2rem",
              }}
            >
              {title}
            </div>
          </div>

          {/* Active Audio State Pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              backgroundColor: "rgba(15, 23, 42, 0.8)",
              padding: "0.4rem 0.85rem",
              borderRadius: "9999px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: themeColor,
                boxShadow: `0 0 10px ${themeColor}`,
                transform: `scale(${pulseScale})`,
              }}
            />
            <span style={{ fontSize: "0.65rem", fontFamily: "monospace", color: "#f8fafc", fontWeight: 600 }}>
              44.1 kHz • LIVE
            </span>
          </div>
        </div>

        {/* Dynamic Spectrum Waveform Visualization */}
        <div
          data-testid="waveform-spectrum"
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: isOverlay ? "3px" : "6px",
            height: isOverlay ? "45%" : "55%",
            width: "100%",
            padding: "0 1rem",
          }}
        >
          {bars.map((bar, idx) => (
            <div
              key={idx}
              style={{
                flex: 1,
                maxWidth: "14px",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                position: "relative",
              }}
            >
              {/* Floating Peak Dot */}
              <div
                style={{
                  position: "absolute",
                  top: `${Math.max(0, 50 - bar.peakHeight / 2)}%`,
                  width: "100%",
                  height: "3px",
                  backgroundColor: themeColor,
                  borderRadius: "1px",
                  opacity: 0.85,
                  boxShadow: `0 0 6px ${themeColor}`,
                }}
              />

              {/* Mirrored Vertical Audio Bar */}
              <div
                style={{
                  width: "100%",
                  height: `${bar.heightPct}%`,
                  borderRadius: "4px",
                  background: `linear-gradient(180deg, ${themeColor} 0%, rgba(56, 189, 248, 0.8) 50%, ${themeColor} 100%)`,
                  boxShadow: `0 0 12px ${themeColor}44`,
                  transition: "height 0.05s ease-out",
                }}
              />
            </div>
          ))}
        </div>

        {/* Bottom Quote / Transcript Line (if provided) */}
        {quote ? (
          <div
            style={{
              position: "relative",
              zIndex: 10,
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              borderRadius: "0.75rem",
              padding: "0.6rem 1rem",
              border: "1px solid rgba(255, 255, 255, 0.06)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: isOverlay ? "0.8rem" : "0.95rem",
                color: "#e2e8f0",
                fontStyle: "italic",
                lineHeight: 1.4,
              }}
            >
              "{quote}"
            </p>
          </div>
        ) : (
          <div style={{ height: "0.5rem" }} />
        )}
      </div>
    </AbsoluteFill>
  );
};
