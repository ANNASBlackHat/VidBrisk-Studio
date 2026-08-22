import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface StandardCardProps {
  text?: string;
  title?: string;
}

export function StandardCard({
  text = "Standard narration text card overlay.",
  title,
}: StandardCardProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 100 },
  });

  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div className="absolute inset-0 flex items-center justify-center p-8 bg-[#090d16]/85 backdrop-blur-md overflow-hidden">
      <div className="absolute w-[500px] h-[300px] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />

      <div
        style={{
          transform: `scale(${scale})`,
          opacity,
        }}
        className="relative z-10 max-w-xl w-full p-8 sm:p-10 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl shadow-blue-950/40 backdrop-blur-xl flex flex-col items-center text-center"
      >
        {title && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-950/80 border border-blue-800/80 mb-4">
            {title}
          </span>
        )}

        <p className="text-lg sm:text-xl font-medium text-slate-100 font-sans leading-relaxed">
          {text}
        </p>
      </div>
    </div>
  );
}
