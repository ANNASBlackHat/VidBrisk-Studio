import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Quote } from "lucide-react";

export interface QuoteCardProps {
  quote?: string;
  emphasis?: string | null;
  author?: string | null;
  text?: string;
}

export function QuoteCard({
  quote,
  emphasis,
  author = "Apollo 11 Overview",
  text,
}: QuoteCardProps) {
  const content = quote || text || "The impossible is only what hasn't been done yet.";
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 90 },
  });

  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(frame, [0, 18], [25, 0], {
    extrapolateRight: "clamp",
  });

  const pulse = Math.sin(frame / 10) * 8;

  // Highlight the emphasized phrase if present
  const renderFormattedQuote = () => {
    if (!emphasis || !content.includes(emphasis)) {
      return <span>&ldquo;{content}&rdquo;</span>;
    }

    const parts = content.split(emphasis);
    return (
      <span>
        &ldquo;{parts[0]}
        <span className="text-purple-400 font-bold underline decoration-purple-500/60 decoration-2 underline-offset-8">
          {emphasis}
        </span>
        {parts.slice(1).join(emphasis)}&rdquo;
      </span>
    );
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#060913",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Background Radial Glow */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full blur-[140px] pointer-events-none"
        style={{
          background: "radial-gradient(circle, #9333ea 0%, rgba(147, 51, 234, 0.3) 40%, transparent 70%)",
          opacity: 0.4,
          transform: `scale(${1 + pulse * 0.02})`,
        }}
      />

      {/* Main Glassmorphic Quote Card */}
      <div
        style={{
          transform: `scale(${scale}) translateY(${translateY}px)`,
          opacity,
        }}
        className="relative z-10 max-w-3xl w-full mx-8 p-10 sm:p-14 rounded-3xl bg-slate-900/80 border border-purple-500/30 shadow-[0_0_80px_rgba(147,51,234,0.25)] backdrop-blur-2xl flex flex-col items-center text-center"
      >
        <div className="p-3.5 rounded-full bg-purple-950/90 border border-purple-700/80 text-purple-400 mb-8 shadow-inner">
          <Quote className="w-7 h-7" />
        </div>

        <blockquote className="text-2xl sm:text-3xl md:text-4xl font-semibold text-slate-100 font-sans leading-relaxed tracking-tight">
          {renderFormattedQuote()}
        </blockquote>

        {author && (
          <div className="mt-8 flex items-center gap-3 text-xs sm:text-sm uppercase tracking-widest text-purple-300 font-mono">
            <span className="w-8 h-px bg-purple-500/80" />
            <span>{author}</span>
            <span className="w-8 h-px bg-purple-500/80" />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}
