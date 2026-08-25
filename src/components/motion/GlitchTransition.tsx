import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { noise2D } from "@remotion/noise";

export interface GlitchTransitionProps {
  glitchFrames?: number;
}

/**
 * Glitch/VHS overlay transition — stylized digital-glitch flash.
 * Pure overlay Sequence, same insertion pattern as FlashTransition.
 * Uses @remotion/noise for organic jitter, no canvas/WebGL needed.
 */
export const GlitchTransition: React.FC<GlitchTransitionProps> = ({
  glitchFrames = 8,
}) => {
  const frame = useCurrentFrame();

  // Overall opacity envelope: quick flicker on/off
  const opacity = interpolate(frame, [0, 1, 2, 4, 6, glitchFrames], [0, 0.9, 0.3, 0.85, 0.2, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Slice bars — 3 horizontal bars with noise-driven translateX jitter
  const sliceBars = [0, 1, 2].map((idx) => {
    const seedOffset = idx * 17;
    const n = noise2D(`glitch-slice-${seedOffset}`, frame * 0.4, 0);
    // Bounded jitter within ~±12px
    const offsetX = n * 12;
    const topPercent = 15 + idx * 28 + noise2D(`glitch-top-${idx}`, frame * 0.2, 0) * 4;
    const heightPercent = 6 + Math.abs(noise2D(`glitch-h-${idx}`, frame * 0.3, 0)) * 8;
    const barOpacity = interpolate(
      frame + idx,
      [0, 2, 4, glitchFrames],
      [0.8, 0.4, 0.9, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    return { offsetX, topPercent, heightPercent, barOpacity };
  });

  // Scanline flicker opacity
  const scanlineOpacity = interpolate(frame, [0, 3, 5, glitchFrames], [0.35, 0.12, 0.28, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Chromatic aberration tint bars (cyan/red faint duplicates)
  const chromaOffset = noise2D("glitch-chroma", frame * 0.5, 0) * 3;

  return (
    <AbsoluteFill
      data-testid="glitch-transition"
      style={{
        pointerEvents: "none",
        opacity,
      }}
    >
      {/* Scanline texture */}
      <AbsoluteFill
        data-testid="glitch-scanlines"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0px, transparent 1px, transparent 3px, rgba(255,255,255,0.04) 4px)",
          opacity: scanlineOpacity,
        }}
      />

      {/* Slice bars */}
      {sliceBars.map((bar, idx) => (
        <div
          key={`slice-${idx}`}
          data-testid={`glitch-slice-${idx}`}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${bar.topPercent}%`,
            height: `${bar.heightPercent}%`,
            backgroundColor: "rgba(255,255,255,0.9)",
            transform: `translateX(${bar.offsetX.toFixed(2)}px)`,
            opacity: bar.barOpacity,
            mixBlendMode: "screen",
          }}
        />
      ))}

      {/* Chromatic aberration approximation — cyan/red tint bars */}
      <AbsoluteFill
        data-testid="glitch-chroma-cyan"
        style={{
          backgroundColor: "rgba(0,255,255,0.08)",
          transform: `translateX(${(chromaOffset - 1.5).toFixed(2)}px)`,
          opacity: interpolate(frame, [1, 4, glitchFrames], [0.4, 0.15, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill
        data-testid="glitch-chroma-red"
        style={{
          backgroundColor: "rgba(255,0,60,0.07)",
          transform: `translateX(${(chromaOffset + 1.5).toFixed(2)}px)`,
          opacity: interpolate(frame, [1, 4, glitchFrames], [0.35, 0.12, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          mixBlendMode: "screen",
        }}
      />

      {/* Noise grain overlay for VHS texture */}
      <AbsoluteFill
        data-testid="glitch-grain"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          opacity: interpolate(frame, [0, 2, glitchFrames], [0.12, 0.06, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          mixBlendMode: "overlay",
        }}
      />
    </AbsoluteFill>
  );
};
