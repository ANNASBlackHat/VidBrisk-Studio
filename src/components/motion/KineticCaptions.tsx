/**
 * KineticCaptions — Word-by-Word Bouncing & Karaoke Subtitle Component
 * Implements Step 4 of plan_advanced_remotion_capabilities.
 * 
 * Provides TikTok / Reels / Shorts style word-level kinetic animations
 * driven by WhisperX/easytranscriber word timestamps with spring scale hits and glowing fills.
 */

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { LayoutRole, WordTiming } from "@/lib/types";
import { resolveDisplay, displayContainerStyle } from "./layoutContract";

export const KINETIC_CAPTIONS_SUPPORTED_ROLES: LayoutRole[] = [
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

export interface KineticCaptionsProps extends Record<string, unknown> {
  text?: string;
  timings?: WordTiming[];
  themeColor?: string;
  styleVariant?: "bouncy" | "karaoke" | "glow";
  durationInFrames?: number;
  layoutRole?: LayoutRole;
}

interface NormalizedWord {
  word: string;
  startSec: number;
  endSec: number;
}

function normalizeTimings(
  rawText?: string,
  timings?: WordTiming[],
  totalDurationSec: number = 4
): NormalizedWord[] {
  if (timings && timings.length > 0) {
    const firstStart = timings[0].start;
    const offset = firstStart > totalDurationSec ? firstStart : 0;
    return timings.map((t) => ({
      word: t.word,
      startSec: Math.max(0, t.start - offset),
      endSec: Math.max(t.start - offset + 0.08, t.end - offset),
    }));
  }

  const words = (rawText || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [{ word: rawText || "", startSec: 0, endSec: totalDurationSec }];
  }

  const perWord = totalDurationSec / words.length;
  return words.map((w, i) => ({
    word: w,
    startSec: i * perWord,
    endSec: (i + 1) * perWord,
  }));
}

export const KineticCaptions: React.FC<KineticCaptionsProps> = ({
  text = "Transforming raw footage into viral cinematic video with AI.",
  timings,
  themeColor = "#facc15", // Vibrant TikTok yellow
  styleVariant = "bouncy",
  durationInFrames: propDuration,
  layoutRole = "overlay-lower-third",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: videoDuration } = useVideoConfig();
  const duration = propDuration || videoDuration || 120;
  const totalDurationSec = duration / fps;

  const display = resolveDisplay({ layoutRole });
  const isOverlay = display === "overlay";

  const words = normalizeTimings(text, timings, totalDurationSec);
  const currentSec = frame / fps;

  return (
    <AbsoluteFill
      style={{
        ...displayContainerStyle(display),
        display: "flex",
        alignItems: "center",
        justifyContent: isOverlay ? "flex-end" : "center",
        padding: isOverlay ? "2rem" : "3rem",
        paddingBottom: isOverlay ? "3.5rem" : "3rem",
      }}
    >
      <div
        data-testid="kinetic-captions-container"
        style={{
          position: "relative",
          maxWidth: "88%",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.45rem 0.65rem",
          padding: "0.85rem 1.5rem",
          borderRadius: "1.25rem",
          backgroundColor: isOverlay ? "rgba(0, 0, 0, 0.75)" : "transparent",
          backdropFilter: isOverlay ? "blur(8px)" : "none",
          border: isOverlay ? "1px solid rgba(255, 255, 255, 0.12)" : "none",
          boxShadow: isOverlay ? "0 10px 30px rgba(0,0,0,0.5)" : "none",
        }}
      >
        {words.map((item, idx) => {
          const isActive = currentSec >= item.startSec && currentSec <= item.endSec;
          const isPast = currentSec > item.endSec;

          // Word hit progress (0 when word starts, 1 when word ends)
          const wordFrameStart = Math.round(item.startSec * fps);
          const wordFrameAge = Math.max(0, frame - wordFrameStart);

          // Spring bounce hit when active
          const bounceScale = isActive
            ? spring({
                frame: wordFrameAge,
                fps,
                config: { damping: 10, stiffness: 220, mass: 0.6 },
              }) * 0.15 + 1.05
            : isPast
            ? 1.0
            : 0.96;

          // Color & Glow
          const wordColor = isActive
            ? themeColor
            : isPast
            ? "#ffffff"
            : "rgba(255, 255, 255, 0.38)";

          const textShadow = isActive
            ? `0 0 16px ${themeColor}aa, 0 2px 4px rgba(0,0,0,0.9)`
            : "0 2px 4px rgba(0,0,0,0.8)";

          return (
            <span
              key={`${idx}-${item.word}`}
              data-testid="caption-word"
              data-active={isActive ? "true" : "false"}
              data-past={isPast ? "true" : "false"}
              style={{
                display: "inline-block",
                fontSize: isOverlay ? "1.5rem" : "2.2rem",
                fontWeight: 900,
                fontFamily: "system-ui, -apple-system, sans-serif",
                textTransform: "uppercase",
                letterSpacing: "-0.01em",
                color: wordColor,
                textShadow,
                transform: `scale(${bounceScale})`,
                transition: "color 0.05s ease-out, transform 0.05s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              }}
            >
              {item.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
