import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { LayoutRole } from "@/lib/types";
import { displayContainerStyle } from "./layoutContract";

export interface SplitScreenProps {
  /** Single-pane (layered) API: which half this clip owns. */
  layoutRole?: LayoutRole;
  paneTitle?: string;
  paneContent?: string;
  text?: string;
  durationInFrames?: number;

  // --- Deprecated two-pane API (pre-layers timelines & MotionGallery) ---
  /** @deprecated layered beats emit one EditorClip per half instead */
  leftTitle?: string;
  /** @deprecated layered beats emit one EditorClip per half instead */
  leftContent?: string;
  /** @deprecated layered beats emit one EditorClip per half instead */
  rightTitle?: string;
  /** @deprecated layered beats emit one EditorClip per half instead */
  rightContent?: string;
  mode?: "overlay" | "takeover";
  display_mode?: "overlay" | "takeover";
}

/** LayoutRoles this component knows how to render. */
export const SPLIT_SCREEN_SUPPORTED_ROLES: LayoutRole[] = [
  "split-left",
  "split-right",
];

const PaneCard: React.FC<{
  title?: string;
  content?: string;
  accent: string;
  slide: number;
  slideFrom: -1 | 1;
}> = ({ title, content, accent, slide, slideFrom }) => (
  <div
    style={{
      translate: `${(1 - slide) * 40 * slideFrom}px 0`,
      opacity: slide,
      padding: "36px 40px",
      borderRadius: 24,
      backgroundColor: "rgba(15, 23, 42, 0.84)",
      backdropFilter: "blur(20px)",
      border:
        accent === "cyan"
          ? "1px solid rgba(56, 189, 248, 0.4)"
          : "1px solid rgba(148, 163, 184, 0.25)",
      boxShadow:
        accent === "cyan"
          ? "0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(56, 189, 248, 0.15)"
          : "0 20px 50px rgba(0,0,0,0.6)",
      color: "#ffffff",
    }}
  >
    <div
      style={{
        fontSize: 12,
        fontFamily: "monospace",
        fontWeight: 700,
        letterSpacing: 2,
        color: accent === "cyan" ? "#38bdf8" : "#94a3b8",
        marginBottom: 12,
      }}
    >
      {(title || "").toUpperCase()}
    </div>
    <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.4, color: "#f1f5f9", margin: 0 }}>
      {content}
    </p>
  </div>
);

export function SplitScreen(props: SplitScreenProps) {
  const frame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const fps = videoConfig.fps;
  const {
    layoutRole,
    paneTitle,
    paneContent,
    text,
    durationInFrames,
    leftTitle = "TRADITIONAL COST",
    leftContent = "Multi-day manual editing and animation cycles.",
    rightTitle = "REMOTION AUTOMATION",
    rightContent = "Deterministic, programmatic render in under 60 seconds.",
    mode,
    display_mode,
  } = props;

  const totalFrames = Math.max(
    30,
    durationInFrames || videoConfig.durationInFrames || 150
  );

  const entranceSpring = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 95 },
  });

  const exitStart = Math.floor(totalFrames * 0.88);
  const exitProgress = interpolate(frame, [exitStart, totalFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitOpacity = 1 - exitProgress;
  const exitScale = interpolate(exitProgress, [0, 1], [1, 0.94]);
  const opacity = entranceSpring * exitOpacity;

  // ---------------------------------------------------------------------------
  // LAYERED MODE — one independently-sourced footage half per clip.
  // Footage itself is a separate layer rendered by VideoComposition; this pane
  // provides the docked text card for its side.
  // ---------------------------------------------------------------------------
  if (layoutRole === "split-left" || layoutRole === "split-right") {
    const isLeft = layoutRole === "split-left";
    return (
      <AbsoluteFill style={displayContainerStyle("overlay")}>
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            [isLeft ? "left" : "right"]: 0,
            width: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isLeft ? "0 16px 0 64px" : "0 64px 0 16px",
          }}
        >
          <PaneCard
            title={paneTitle}
            content={paneContent || text || (isLeft ? leftContent : rightContent)}
            accent={isLeft ? "slate" : "cyan"}
            slide={opacity}
            slideFrom={isLeft ? -1 : 1}
          />
        </div>
      </AbsoluteFill>
    );
  }

  // ---------------------------------------------------------------------------
  // LEGACY MODE — one component owning both halves (deprecated).
  // ---------------------------------------------------------------------------
  const leftSlide = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 95 },
  });

  const rightSlide = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 95 },
  });

  const effectiveMode = display_mode || mode || "overlay";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: effectiveMode === "takeover" ? "#030712" : "transparent",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        padding: "0 64px",
      }}
    >
      <div
        style={{
          scale: `${exitScale}`,
          opacity: exitOpacity,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 32,
          maxWidth: 1100,
          width: "100%",
          zIndex: 10,
        }}
      >
        <PaneCard
          title={leftTitle}
          content={leftContent}
          accent="slate"
          slide={leftSlide}
          slideFrom={-1}
        />
        <PaneCard
          title={rightTitle}
          content={text || rightContent}
          accent="cyan"
          slide={rightSlide}
          slideFrom={1}
        />
      </div>
    </AbsoluteFill>
  );
}
