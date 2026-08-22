import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export interface TypewriterProps {
  text?: string;
  variant?: string;
  charactersPerSecond?: number;
  highlightWords?: string[];
}

export function Typewriter({
  text = "In July 1969, humanity embarked on its most daring voyage...",
  charactersPerSecond = 24,
}: TypewriterProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalChars = text.length;
  const charsShown = Math.min(
    totalChars,
    Math.floor((frame / fps) * charactersPerSecond)
  );

  const displayedText = text.slice(0, charsShown);

  // Blinking cursor every 15 frames
  const cursorOpacity = Math.floor(frame / 12) % 2 === 0 ? 1 : 0;

  const cardOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div className="absolute inset-0 flex items-center justify-center p-8 bg-[#090d16]/85 backdrop-blur-md overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute w-[600px] h-[400px] rounded-full bg-blue-600/15 blur-[120px] pointer-events-none" />

      {/* Typewriter text container */}
      <div
        style={{ opacity: cardOpacity }}
        className="relative z-10 max-w-2xl w-full p-8 sm:p-12 rounded-3xl bg-slate-900/90 border border-slate-700/80 shadow-2xl shadow-blue-950/40 backdrop-blur-xl flex flex-col items-start text-left"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full bg-rose-500/80" />
          <div className="w-3 h-3 rounded-full bg-amber-500/80" />
          <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          <span className="text-[11px] font-mono text-slate-500 ml-2">Narration Focus</span>
        </div>

        <p className="text-xl sm:text-2xl md:text-3xl font-semibold text-slate-100 font-mono leading-relaxed">
          {displayedText}
          <span
            style={{ opacity: cursorOpacity }}
            className="inline-block w-3 h-7 ml-1 bg-blue-400 align-middle"
          />
        </p>
      </div>
    </div>
  );
}
