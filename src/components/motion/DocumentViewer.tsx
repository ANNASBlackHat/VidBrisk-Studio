import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { LayoutRole } from "@/lib/types";
import { resolveDisplay, displayContainerStyle } from "./layoutContract";

export interface DocumentViewerProps {
  imageUrl?: string | null;
  title?: string;
  subtext?: string | null;
  highlightText?: string | null;
  zoom?: number;
  durationInFrames?: number;
  text?: string;
  layoutRole?: LayoutRole;
  mode?: "overlay" | "takeover";
  display_mode?: "overlay" | "takeover";
}

export const DOCUMENT_VIEWER_SUPPORTED_ROLES: LayoutRole[] = [
  "full",
  "takeover",
  "overlay-lower-third",
];

export function DocumentViewer({
  imageUrl,
  title = "ARCHIVAL RECORD",
  subtext = "CONTEMPORARY 19TH-CENTURY DOCUMENT",
  highlightText,
  zoom = 1.15,
  durationInFrames,
  text,
  layoutRole,
  mode,
  display_mode,
}: DocumentViewerProps) {
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

  const opacity = interpolate(
    frame,
    [0, entranceEnd, exitStart, totalFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Subtle Ken Burns slow pan and zoom
  const currentZoom = interpolate(frame, [0, totalFrames], [1.0, zoom], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panY = interpolate(frame, [0, totalFrames], [0, -15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Highlight pulse / reveal after 20 frames
  const highlightProgress = spring({
    frame: Math.max(0, frame - 25),
    fps,
    config: { damping: 15, mass: 0.8, stiffness: 80 },
  });

  const displayText = highlightText || text;

  return (
    <AbsoluteFill
      style={{
        ...displayContainerStyle(effectiveMode),
        opacity,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif",
      }}
    >
      {/* Background Archival Matting */}
      <div className="absolute inset-0 bg-[#0a0c10] bg-opacity-95 flex items-center justify-center overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-contain filter contrast-125 sepia-[0.25]"
            style={{
              transform: `scale(${currentZoom}) translateY(${panY}px)`,
              transition: "transform 0.1s linear",
            }}
          />
        ) : (
          <div
            className="w-[85%] h-[80%] border border-[#3b4252] rounded-sm bg-[#12151c] flex flex-col items-center justify-center p-8 relative shadow-2xl"
            style={{
              transform: `scale(${currentZoom}) translateY(${panY}px)`,
            }}
          >
            {/* Paper Texture / Watermark Lines */}
            <div className="absolute inset-4 border border-[#2e3440] opacity-40 pointer-events-none" />
            <div className="text-[#88c0d0] tracking-[0.3em] text-xs font-mono uppercase mb-4 opacity-80">
              {title}
            </div>
            {displayText && (
              <div className="max-w-2xl text-center relative px-6 py-4">
                <div
                  className="absolute inset-0 bg-[#e5c07b] bg-opacity-20 rounded"
                  style={{
                    transform: `scaleX(${highlightProgress})`,
                    transformOrigin: "left center",
                  }}
                />
                <p className="relative z-10 text-xl md:text-2xl text-[#eceff4] font-serif leading-relaxed italic">
                  "{displayText}"
                </p>
              </div>
            )}
            {subtext && (
              <div className="mt-8 text-xs font-mono tracking-widest text-[#d8dee9] opacity-60">
                {subtext}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Forensic Header Bar */}
      <div className="absolute top-8 left-12 right-12 flex justify-between items-center border-b border-[#434c5e] pb-3 text-xs font-mono text-[#d8dee9] tracking-wider z-20">
        <div className="flex items-center space-x-2">
          <span className="inline-block w-2 h-2 rounded-full bg-[#88c0d0] animate-pulse" />
          <span className="font-bold text-[#eceff4]">{title}</span>
        </div>
        <div className="opacity-70">{subtext}</div>
      </div>
    </AbsoluteFill>
  );
}
