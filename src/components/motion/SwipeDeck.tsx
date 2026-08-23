import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";
import { Layers, CheckCircle2 } from "lucide-react";
import { LayoutRole } from "@/lib/types";
import {
  resolveDisplay,
  displayContainerStyle,
} from "./layoutContract";

export interface SwipeDeckProps {
  items?: string[];
  durationInFrames?: number;
  layoutRole?: LayoutRole;
  themeColor?: string;
  text?: string; // fallback: single-item deck if items absent
  title?: string;
  /** @deprecated use layoutRole */
  mode?: "overlay" | "takeover" | "adaptive";
  /** @deprecated use layoutRole */
  display_mode?: "overlay" | "takeover";
}

/** LayoutRoles this component knows how to render. */
export const SWIPE_DECK_SUPPORTED_ROLES: LayoutRole[] = [
  "full",
  "takeover",
  "overlay-lower-third",
];

export function SwipeDeck({
  items,
  durationInFrames,
  layoutRole,
  themeColor = "#38bdf8",
  text,
  title,
  mode,
  display_mode,
}: SwipeDeckProps) {
  const frame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const fps = videoConfig.fps || 30;

  const totalFrames = Math.max(
    30,
    durationInFrames || videoConfig.durationInFrames || 150
  );

  const effectiveMode = resolveDisplay({
    layoutRole,
    mode: mode === "adaptive" ? undefined : mode,
    display_mode,
  });

  // Normalize items array with fallback to text or default items
  const effectiveItems: string[] = React.useMemo(() => {
    if (items && Array.isArray(items) && items.length > 0) {
      const filtered = items.map((s) => String(s).trim()).filter(Boolean);
      if (filtered.length > 0) return filtered.slice(0, 5);
    }
    if (text && text.trim().length > 0) {
      return [text.trim()];
    }
    return ["Key Highlight", "Strategic Insight", "Execution Plan"];
  }, [items, text]);

  const count = effectiveItems.length;
  const slotDuration = totalFrames / count;

  // Global deck entrance (first 12% of total frames)
  const deckEntranceEnd = Math.max(1, Math.floor(totalFrames * 0.12));
  const deckEntranceSpring = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 95 },
  });
  const deckEntranceOpacity = interpolate(
    frame,
    [0, deckEntranceEnd],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Global soft exit (final 12% of total frames)
  const exitStart = Math.floor(totalFrames * 0.88);
  const exitProgress = interpolate(
    frame,
    [exitStart, totalFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const exitOpacity = 1 - exitProgress;
  const exitScale = interpolate(exitProgress, [0, 1], [1, 0.94]);
  const exitTranslateY = interpolate(exitProgress, [0, 1], [0, -15]);

  const rawTitle = title || "KEY HIGHLIGHTS";
  const activeIndex = Math.min(count - 1, Math.floor(frame / slotDuration));

  // ---------------------------------------------------------------------------
  // Helper to render individual card in the deck
  // ---------------------------------------------------------------------------
  const renderCard = (itemText: string, index: number, isOverlay: boolean) => {
    const slotStart = index * slotDuration;
    const slotEnd = (index + 1) * slotDuration;
    const isLastCard = index === count - 1;

    // Has this card already swiped out and gone?
    if (frame >= slotEnd && !isLastCard) {
      return null;
    }

    const isActive = index === activeIndex;
    const isUpcoming = index > activeIndex;
    const depth = index - activeIndex;

    let cardOpacity = 1;
    let cardScale = 1;
    let cardTranslateX = 0;
    let cardTranslateY = 0;
    let cardRotate = 0;

    if (isActive) {
      // Top active card
      if (index === 0) {
        cardOpacity = deckEntranceOpacity;
        cardScale = deckEntranceSpring;
      }

      // Exit swipe transition for active card (unless last card, which uses soft exit)
      if (!isLastCard) {
        const swipeDuration = Math.max(8, Math.floor(slotDuration * 0.22));
        const swipeStart = slotEnd - swipeDuration;

        if (frame >= swipeStart) {
          const swipeProgress = interpolate(
            frame,
            [swipeStart, slotEnd],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.2, 0, 0, 1),
            }
          );
          // Deterministic alternating swipe direction: left for even, right for odd
          const direction = index % 2 === 0 ? -1 : 1;
          cardTranslateX = swipeProgress * direction * (isOverlay ? 550 : 850);
          cardRotate = swipeProgress * direction * 16;
          cardOpacity = 1 - swipeProgress;
          cardScale = interpolate(swipeProgress, [0, 1], [1, 0.92]);
        }
      } else {
        // Last card applies global soft exit
        cardOpacity = cardOpacity * exitOpacity;
        cardScale = cardScale * exitScale;
        cardTranslateY = exitTranslateY;
      }
    } else if (isUpcoming) {
      // Cards resting in stack behind active card
      const peekDirection = index % 2 === 0 ? -1 : 1;
      cardScale = Math.max(0.85, 1 - depth * 0.04);
      cardTranslateY = depth * (isOverlay ? 8 : 12);
      cardRotate = peekDirection * depth * 2.5;
      cardOpacity = depth <= 3 ? Math.max(0.3, 1 - depth * 0.28) * deckEntranceOpacity : 0;

      // When approaching active slot, smoothly scale up to 1
      const prevSlotEnd = index * slotDuration;
      const transitionWindow = Math.max(8, Math.floor(slotDuration * 0.22));
      const transitionStart = prevSlotEnd - transitionWindow;

      if (frame >= transitionStart && frame < prevSlotEnd && depth === 1) {
        const t = interpolate(frame, [transitionStart, prevSlotEnd], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        cardScale = interpolate(t, [0, 1], [cardScale, 1]);
        cardTranslateY = interpolate(t, [0, 1], [cardTranslateY, 0]);
        cardRotate = interpolate(t, [0, 1], [cardRotate, 0]);
        cardOpacity = interpolate(t, [0, 1], [cardOpacity, 1]);
      }
    }

    const zIndex = 50 - index;

    if (isOverlay) {
      // Compact Lower-Third Deck Item
      return (
        <div
          key={`swipe-card-${index}`}
          data-testid="swipe-card"
          data-index={index}
          style={{
            position: "absolute",
            inset: 0,
            zIndex,
            opacity: cardOpacity,
            transform: `translate(${cardTranslateX}px, ${cardTranslateY}px) rotate(${cardRotate}deg) scale(${cardScale})`,
            transformOrigin: "bottom center",
            backgroundColor: "rgba(10, 15, 29, 0.92)",
            backdropFilter: "blur(24px)",
            borderRadius: 20,
            border: `1px solid ${isActive ? `${themeColor}60` : "rgba(255, 255, 255, 0.12)"}`,
            boxShadow: isActive
              ? `0 20px 50px -10px rgba(0, 0, 0, 0.85), 0 0 30px ${themeColor}20`
              : "0 10px 30px rgba(0,0,0,0.5)",
            padding: "20px 26px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Card Top Pill */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold text-white shadow-sm"
                style={{ backgroundColor: themeColor }}
              >
                {index + 1}
              </span>
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-300 font-semibold">
                Item {index + 1} of {count}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {rawTitle}
            </span>
          </div>

          {/* Card Text */}
          <div className="text-white text-lg sm:text-xl font-bold tracking-tight leading-snug line-clamp-2">
            {itemText}
          </div>

          {/* Bottom Progress Bar */}
          <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden mt-3">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${((index + 1) / count) * 100}%`,
                backgroundColor: themeColor,
                boxShadow: `0 0 8px ${themeColor}`,
              }}
            />
          </div>
        </div>
      );
    }

    // Full / Takeover Large Hero Deck Item
    return (
      <div
        key={`swipe-card-${index}`}
        data-testid="swipe-card"
        data-index={index}
        style={{
          position: "absolute",
          inset: 0,
          zIndex,
          opacity: cardOpacity,
          transform: `translate(${cardTranslateX}px, ${cardTranslateY}px) rotate(${cardRotate}deg) scale(${cardScale})`,
          transformOrigin: "bottom center",
          backgroundColor: "rgba(15, 23, 42, 0.94)",
          backdropFilter: "blur(28px)",
          borderRadius: 28,
          border: `1px solid ${isActive ? `${themeColor}70` : "rgba(255, 255, 255, 0.15)"}`,
          boxShadow: isActive
            ? `0 30px 80px rgba(0, 0, 0, 0.8), 0 0 50px ${themeColor}25`
            : "0 15px 40px rgba(0, 0, 0, 0.6)",
          padding: "36px 44px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="px-3.5 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider text-white flex items-center gap-1.5 shadow-md"
              style={{ backgroundColor: themeColor }}
            >
              <CheckCircle2 size={14} />
              <span>Step {index + 1} of {count}</span>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-400 tracking-wider uppercase font-semibold">
            {rawTitle}
          </span>
        </div>

        {/* Card Body Text */}
        <div className="my-auto py-2">
          <div
            className="text-white text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight"
            style={{
              textShadow: "0 2px 14px rgba(0,0,0,0.8)",
            }}
          >
            {itemText}
          </div>
        </div>

        {/* Card Footer with Progress Dots & Bar */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {effectiveItems.map((_, dotIdx) => (
              <div
                key={`dot-${dotIdx}`}
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: dotIdx === index ? 24 : 8,
                  backgroundColor: dotIdx <= index ? themeColor : "rgba(255,255,255,0.2)",
                  boxShadow: dotIdx === index ? `0 0 10px ${themeColor}` : "none",
                }}
              />
            ))}
          </div>

          <span className="text-xs font-mono text-slate-400">
            {index + 1} / {count}
          </span>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // OVERLAY LAYOUT (Lower-Third Docked Stack)
  // ---------------------------------------------------------------------------
  if (effectiveMode === "overlay") {
    return (
      <AbsoluteFill style={displayContainerStyle("overlay")}>
        <div
          style={{
            position: "absolute",
            bottom: 50,
            left: 64,
            maxWidth: 720,
            width: "calc(100% - 128px)",
            height: 160,
          }}
        >
          {effectiveItems.map((item, idx) => renderCard(item, idx, true))}
        </div>
      </AbsoluteFill>
    );
  }

  // ---------------------------------------------------------------------------
  // FULL / TAKEOVER LAYOUT (Center Stage Cinematic Deck)
  // ---------------------------------------------------------------------------
  return (
    <AbsoluteFill
      style={{
        ...displayContainerStyle("takeover"),
        backgroundColor: "#030712",
        justifyContent: "center",
        alignItems: "center",
        padding: "48px 64px",
      }}
    >
      {/* Background Blueprint Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(to right, ${themeColor}12 1px, transparent 1px), linear-gradient(to bottom, ${themeColor}12 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          pointerEvents: "none",
        }}
      />

      {/* Ambient background glow */}
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${themeColor}30 0%, rgba(30, 58, 138, 0.15) 50%, transparent 75%)`,
          filter: "blur(100px)",
          pointerEvents: "none",
        }}
      />

      {/* Center Stack Wrapper */}
      <div className="relative z-10 flex flex-col items-center max-w-3xl w-full">
        {/* Top Kicker Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-white/10 mb-8 backdrop-blur-md shadow-lg">
          <Layers size={15} style={{ color: themeColor }} />
          <span className="text-xs font-mono font-bold tracking-widest text-slate-200 uppercase">
            {rawTitle} • CARD {activeIndex + 1} OF {count}
          </span>
        </div>

        {/* Card Deck Container */}
        <div
          className="relative w-full max-w-2xl"
          style={{
            height: 340,
          }}
        >
          {effectiveItems.map((item, idx) => renderCard(item, idx, false))}
        </div>
      </div>
    </AbsoluteFill>
  );
}
