import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { LayoutRole, WordTiming } from "@/lib/types";
import {
  resolveDisplay,
  displayContainerStyle,
} from "./layoutContract";
import { BaseMotionProps } from "./registry";

export interface KineticTextProps extends BaseMotionProps {
  text?: string;
  timings?: WordTiming[];
  mode?: "reveal" | "karaoke";
  durationInFrames?: number;
  themeColor?: string;
  layoutRole?: LayoutRole;
  /** @deprecated use layoutRole */
  display_mode?: "overlay" | "takeover";
}

/** LayoutRoles this component knows how to render. */
export const KINETIC_TEXT_SUPPORTED_ROLES: LayoutRole[] = [
  "full",
  "takeover",
  "overlay-lower-third",
  "corner-tl",
  "corner-tr",
  "corner-bl",
  "corner-br",
];

interface NormalizedWord {
  word: string;
  start: number; // in seconds
  end: number;   // in seconds
  score?: number;
}

/**
 * Builds a normalized list of words with timing.
 * If timings is empty or missing, synthetically distributes words across the duration.
 */
function getNormalizedWords(
  rawText: string,
  timings?: WordTiming[],
  totalDurationSec: number = 4
): NormalizedWord[] {
  if (timings && timings.length > 0) {
    // If timings are present, normalize starting offset so timings start near 0
    const firstStart = timings[0].start;
    const offset = firstStart > totalDurationSec ? firstStart : 0;

    return timings.map((t) => ({
      word: t.word,
      start: Math.max(0, t.start - offset),
      end: Math.max(t.start - offset + 0.05, t.end - offset),
      score: t.score,
    }));
  }

  // Fallback: synthetically space words across the clip duration
  const words = rawText.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [{ word: rawText || "", start: 0, end: totalDurationSec }];
  }

  const durationPerWord = totalDurationSec / words.length;
  return words.map((w, i) => ({
    word: w,
    start: i * durationPerWord,
    end: (i + 1) * durationPerWord,
  }));
}

export function KineticText({
  text = "Transforming ideas into high impact visual stories with AI.",
  timings,
  mode = "reveal",
  durationInFrames,
  themeColor = "#38bdf8",
  layoutRole,
  display_mode,
}: KineticTextProps) {
  const frame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const fps = videoConfig.fps || 30;

  const effectiveMode = resolveDisplay({
    layoutRole,
    mode: display_mode === "takeover" ? "takeover" : undefined,
    display_mode,
  });

  const totalFrames = Math.max(
    30,
    durationInFrames || videoConfig.durationInFrames || 150
  );
  const totalDurationSec = totalFrames / fps;

  const words = getNormalizedWords(text, timings, totalDurationSec);

  // Overall card entrance & soft exit
  const entranceEnd = Math.floor(totalFrames * 0.1);
  const exitStart = Math.floor(totalFrames * 0.9);

  const containerEntranceOpacity = interpolate(
    frame,
    [0, Math.max(1, entranceEnd)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const exitProgress = interpolate(
    frame,
    [exitStart, totalFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const containerExitOpacity = 1 - exitProgress;
  const containerExitScale = interpolate(exitProgress, [0, 1], [1, 0.96]);
  const containerOpacity = containerEntranceOpacity * containerExitOpacity;

  // Active word index lookup for karaoke mode
  const currentSec = frame / fps;
  let activeIndex = -1;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (currentSec >= w.start && currentSec <= w.end) {
      activeIndex = i;
      break;
    }
  }
  // If in a gap between words or before/after, find nearest or last passed word
  if (activeIndex === -1 && words.length > 0) {
    if (currentSec < words[0].start) {
      activeIndex = -1;
    } else if (currentSec > words[words.length - 1].end) {
      activeIndex = words.length - 1;
    } else {
      for (let i = 0; i < words.length - 1; i++) {
        if (currentSec > words[i].end && currentSec < words[i + 1].start) {
          activeIndex = i;
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Render Mode 1: REVEAL (Word-by-word entrance synced to timestamps)
  // ---------------------------------------------------------------------------
  const renderRevealWords = (isOverlay: boolean) => {
    return (
      <div
        className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 leading-snug tracking-tight"
        style={{
          fontSize: isOverlay ? "1.35rem" : "2.5rem",
          fontWeight: 700,
        }}
      >
        {words.map((item, index) => {
          const wordStartFrame = Math.round(item.start * fps);
          const frameSinceStart = frame - wordStartFrame;

          if (frameSinceStart < 0) {
            // Not revealed yet
            return (
              <span
                key={`${item.word}-${index}`}
                data-testid="kinetic-word"
                data-word={item.word}
                style={{
                  opacity: 0,
                  display: "inline-block",
                  transform: "translateY(12px) scale(0.92)",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              >
                {item.word}
              </span>
            );
          }

          const wordSpring = spring({
            frame: frameSinceStart,
            fps,
            config: { damping: 14, mass: 0.5, stiffness: 130 },
          });

          const wordOpacity = interpolate(
            frameSinceStart,
            [0, 6],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          const wordTranslateY = interpolate(
            frameSinceStart,
            [0, 8],
            [14, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          const wordScale = interpolate(
            wordSpring,
            [0, 1],
            [0.92, 1.0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          // Subtle emphasis glow on the most recently revealed word
          const isLatest =
            frameSinceStart >= 0 && frameSinceStart <= Math.max(10, Math.round((item.end - item.start) * fps));

          return (
            <span
              key={`${item.word}-${index}`}
              data-testid="kinetic-word"
              data-word={item.word}
              style={{
                opacity: wordOpacity,
                transform: `translateY(${wordTranslateY}px) scale(${wordScale})`,
                color: isLatest ? themeColor : "#f8fafc",
                textShadow: isLatest
                  ? `0 0 18px ${themeColor}66, 0 2px 10px rgba(0,0,0,0.8)`
                  : "0 2px 8px rgba(0,0,0,0.7)",
                display: "inline-block",
                transition: "color 0.15s ease",
              }}
            >
              {item.word}
            </span>
          );
        })}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Render Mode 2: KARAOKE (Full text visible, active word highlighted)
  // ---------------------------------------------------------------------------
  const renderKaraokeWords = (isOverlay: boolean) => {
    return (
      <div
        className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 leading-snug tracking-tight"
        style={{
          fontSize: isOverlay ? "1.35rem" : "2.5rem",
          fontWeight: 700,
        }}
      >
        {words.map((item, index) => {
          const isActive = index === activeIndex;
          const isPast = activeIndex !== -1 && index < activeIndex;

          const wordStartFrame = Math.round(item.start * fps);
          const wordEndFrame = Math.round(item.end * fps);
          const wordDuration = Math.max(1, wordEndFrame - wordStartFrame);
          const wordMidFrame = wordStartFrame + wordDuration / 2;

          let pulseScale = 1.0;
          if (isActive) {
            pulseScale = interpolate(
              frame,
              [wordStartFrame, wordMidFrame, wordEndFrame],
              [1.0, 1.14, 1.06],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
          }

          let opacity = 0.85;
          let color = "#f8fafc";
          let textShadow = "0 2px 8px rgba(0,0,0,0.7)";

          if (isActive) {
            opacity = 1.0;
            color = themeColor;
            textShadow = `0 0 22px ${themeColor}88, 0 0 10px ${themeColor}44, 0 2px 10px rgba(0,0,0,0.9)`;
          } else if (isPast) {
            opacity = 0.55;
            color = "#cbd5e1";
            textShadow = "none";
          }

          return (
            <span
              key={`${item.word}-${index}`}
              data-testid="kinetic-word"
              data-word={item.word}
              style={{
                opacity,
                color,
                textShadow,
                transform: `scale(${pulseScale})`,
                display: "inline-block",
                transition: "opacity 0.2s ease, color 0.2s ease, transform 0.15s ease",
              }}
            >
              {item.word}
            </span>
          );
        })}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // OVERLAY LAYOUT (Lower-Third Glassmorphic Floating Card)
  // ---------------------------------------------------------------------------
  if (effectiveMode === "overlay") {
    return (
      <AbsoluteFill style={displayContainerStyle("overlay")}>
        <div
          style={{
            position: "absolute",
            bottom: 48,
            left: 56,
            maxWidth: 780,
            width: "calc(100% - 112px)",
            opacity: containerOpacity,
            transform: `scale(${containerExitScale})`,
            backgroundColor: "rgba(9, 13, 22, 0.86)",
            backdropFilter: "blur(24px)",
            borderRadius: 22,
            border: `1px solid ${themeColor}40`,
            boxShadow: `0 20px 50px -10px rgba(0, 0, 0, 0.85), 0 0 30px ${themeColor}20`,
            padding: "22px 28px",
          }}
        >
          {/* Accent indicator bar */}
          <div className="flex items-center gap-2 mb-2.5">
            <div
              className="w-2.5 h-2.5 rounded-full animate-pulse"
              style={{ backgroundColor: themeColor, boxShadow: `0 0 8px ${themeColor}` }}
            />
            <span
              className="text-[11px] font-mono font-semibold uppercase tracking-widest"
              style={{ color: themeColor }}
            >
              {mode === "karaoke" ? "LIVE SYNC • KARAOKE" : "KINETIC • SPEECH REVEAL"}
            </span>
          </div>

          {/* Word content */}
          {mode === "karaoke" ? renderKaraokeWords(true) : renderRevealWords(true)}
        </div>
      </AbsoluteFill>
    );
  }

  // ---------------------------------------------------------------------------
  // TAKEOVER / FULL LAYOUT (Cinematic Center Stage)
  // ---------------------------------------------------------------------------
  return (
    <AbsoluteFill
      style={{
        ...displayContainerStyle("takeover"),
        backgroundColor: "#090d16",
        justifyContent: "center",
        alignItems: "center",
        padding: "48px 80px",
      }}
    >
      {/* Ambient background glows */}
      <div
        className="absolute w-[800px] h-[500px] rounded-full blur-[140px] pointer-events-none opacity-25"
        style={{ backgroundColor: themeColor }}
      />
      <div className="absolute w-[500px] h-[300px] rounded-full blur-[100px] pointer-events-none opacity-20 bg-indigo-600 top-1/4 right-1/4" />

      {/* Main kinetic typography container */}
      <div
        className="relative z-10 max-w-5xl w-full text-center flex flex-col items-center justify-center p-8 rounded-3xl"
        style={{
          opacity: containerOpacity,
          transform: `scale(${containerExitScale})`,
        }}
      >
        {/* Subtle kicker badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6 backdrop-blur-md">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: themeColor, boxShadow: `0 0 6px ${themeColor}` }}
          />
          <span className="text-xs font-mono font-medium tracking-wider text-slate-300 uppercase">
            {mode === "karaoke" ? "KARAOKE EMPHASIS" : "KINETIC TYPOGRAPHY"}
          </span>
        </div>

        {/* Content */}
        {mode === "karaoke" ? renderKaraokeWords(false) : renderRevealWords(false)}
      </div>
    </AbsoluteFill>
  );
}
