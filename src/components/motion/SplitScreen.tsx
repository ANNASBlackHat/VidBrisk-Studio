import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface SplitScreenProps {
  leftTitle?: string;
  leftContent?: string;
  rightTitle?: string;
  rightContent?: string;
  durationInFrames?: number;
  text?: string;
}

export function SplitScreen({
  leftTitle = "Concept A",
  leftContent = "High precision, automated execution",
  rightTitle = "Concept B",
  rightContent = "Human verified, custom polished",
  durationInFrames,
  text,
}: SplitScreenProps) {
  const frame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const fps = videoConfig.fps;

  const totalFrames = Math.max(
    30,
    durationInFrames || videoConfig.durationInFrames || 150
  );

  const leftSlide = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 90 },
  });

  const rightSlide = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 90 },
  });

  const exitStart = Math.floor(totalFrames * 0.88);
  const exitProgress = interpolate(frame, [exitStart, totalFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = 1 - exitProgress;
  const exitScale = interpolate(exitProgress, [0, 1], [1, 0.94]);

  return (
    <div className="absolute inset-0 flex items-center justify-center p-8 bg-[#090d16]/90 backdrop-blur-md overflow-hidden">
      <div
        style={{
          transform: `scale(${exitScale})`,
          opacity: exitOpacity,
        }}
        className="relative z-10 max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {/* Left Pane */}
        <div
          style={{
            transform: `translateX(${(1 - leftSlide) * -50}px)`,
            opacity: leftSlide,
          }}
          className="p-8 rounded-3xl bg-slate-900/90 border border-blue-900/60 shadow-xl shadow-blue-950/30 flex flex-col justify-center text-center"
        >
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-blue-400 mb-2">
            {leftTitle}
          </span>
          <p className="text-base sm:text-lg font-semibold text-slate-100 font-sans">
            {leftContent}
          </p>
        </div>

        {/* Right Pane */}
        <div
          style={{
            transform: `translateX(${(1 - rightSlide) * 50}px)`,
            opacity: rightSlide,
          }}
          className="p-8 rounded-3xl bg-slate-900/90 border border-purple-900/60 shadow-xl shadow-purple-950/30 flex flex-col justify-center text-center"
        >
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-purple-400 mb-2">
            {rightTitle}
          </span>
          <p className="text-base sm:text-lg font-semibold text-slate-100 font-sans">
            {text || rightContent}
          </p>
        </div>
      </div>
    </div>
  );
}
