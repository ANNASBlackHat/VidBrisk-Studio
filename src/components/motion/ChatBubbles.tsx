import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { MessageSquare, Bot, User, Sparkles } from "lucide-react";
import { LayoutRole } from "@/lib/types";
import {
  resolveDisplay,
  displayContainerStyle,
} from "./layoutContract";

export interface ChatBubbleMessage {
  text: string;
  sender?: "system" | "user" | "bot" | "ai" | "assistant";
}

export interface ChatBubblesProps {
  messages?: ChatBubbleMessage[];
  durationInFrames?: number;
  layoutRole?: LayoutRole;
  themeColor?: string;
  text?: string; // fallback: single bubble if messages absent
  title?: string;
  /** @deprecated use layoutRole */
  mode?: "overlay" | "takeover" | "adaptive";
  /** @deprecated use layoutRole */
  display_mode?: "overlay" | "takeover";
}

/** LayoutRoles this component knows how to render. */
export const CHAT_BUBBLES_SUPPORTED_ROLES: LayoutRole[] = [
  "full",
  "takeover",
  "overlay-lower-third",
];

export function ChatBubbles({
  messages,
  durationInFrames,
  layoutRole,
  themeColor = "#3b82f6",
  text,
  title,
  mode,
  display_mode,
}: ChatBubblesProps) {
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

  // Normalize messages array with fallback to text or default messages
  const effectiveMessages: ChatBubbleMessage[] = React.useMemo(() => {
    if (messages && Array.isArray(messages) && messages.length > 0) {
      const filtered = messages
        .filter((m) => m && typeof m.text === "string" && m.text.trim().length > 0)
        .map((m) => ({ text: m.text.trim(), sender: m.sender || "system" }));
      if (filtered.length > 0) return filtered.slice(0, 5);
    }
    if (text && text.trim().length > 0) {
      return [{ text: text.trim(), sender: "system" }];
    }
    return [
      { text: "Initiating workflow and verifying parameters...", sender: "system" },
      { text: "Confirmed. Ready to deploy automated pipeline.", sender: "user" },
    ];
  }, [messages, text]);

  const count = effectiveMessages.length;

  // Global soft exit (final 12% of total frames)
  const exitStart = Math.floor(totalFrames * 0.88);
  const exitProgress = interpolate(
    frame,
    [exitStart, totalFrames],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const exitOpacity = 1 - exitProgress;
  const exitScale = interpolate(exitProgress, [0, 1], [1, 0.95]);
  const exitTranslateY = interpolate(exitProgress, [0, 1], [0, -15]);

  const rawTitle = title || "CONVERSATION THREAD";

  // Stagger calculation: all messages enter within first ~72% of total duration
  const staggerWindow = totalFrames * 0.72;

  // ---------------------------------------------------------------------------
  // Helper to render individual chat bubble
  // ---------------------------------------------------------------------------
  const renderBubble = (msg: ChatBubbleMessage, index: number, isOverlay: boolean) => {
    const isUser = msg.sender === "user";

    const startFrame =
      count === 1 ? 0 : Math.round((index * staggerWindow) / (count - 0.2));
    const frameSinceStart = frame - startFrame;

    if (frameSinceStart < 0) {
      return null;
    }

    const bubbleSpring = spring({
      frame: frameSinceStart,
      fps,
      config: { damping: 14, mass: 0.6, stiffness: 95 },
    });

    const bubbleOpacity = interpolate(
      frameSinceStart,
      [0, 8],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    const bubbleTranslateY = interpolate(
      frameSinceStart,
      [0, 10],
      [18, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    const bubbleScale = interpolate(
      bubbleSpring,
      [0, 1],
      [0.85, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    return (
      <div
        key={`bubble-${index}`}
        data-testid="chat-bubble"
        data-sender={isUser ? "user" : "system"}
        data-index={index}
        className={`flex items-end gap-2.5 my-1.5 ${
          isUser ? "justify-end ml-auto" : "justify-start mr-auto"
        }`}
        style={{
          opacity: bubbleOpacity,
          transform: `translateY(${bubbleTranslateY}px) scale(${bubbleScale})`,
          transformOrigin: isUser ? "bottom right" : "bottom left",
          maxWidth: isOverlay ? "88%" : "78%",
        }}
      >
        {/* Left Avatar for System / AI */}
        {!isUser && (
          <div
            className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 shrink-0 shadow-md mb-1"
          >
            <Bot size={15} />
          </div>
        )}

        {/* Bubble Box */}
        <div
          className={`px-4 py-2.5 shadow-lg ${
            isUser
              ? "rounded-2xl rounded-tr-sm text-white"
              : "rounded-2xl rounded-tl-sm text-slate-100"
          }`}
          style={{
            background: isUser
              ? `linear-gradient(135deg, ${themeColor} 0%, #1d4ed8 100%)`
              : "rgba(15, 23, 42, 0.88)",
            border: isUser
              ? `1px solid ${themeColor}90`
              : "1px solid rgba(255, 255, 255, 0.12)",
            backdropFilter: "blur(20px)",
            boxShadow: isUser
              ? `0 8px 24px ${themeColor}35`
              : "0 8px 24px rgba(0, 0, 0, 0.4)",
          }}
        >
          {/* Sender Header */}
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                isUser ? "text-blue-100" : "text-sky-400"
              }`}
            >
              {isUser ? "User" : "AI Assistant"}
            </span>
          </div>

          {/* Message Text */}
          <div
            className={`font-medium tracking-tight leading-snug ${
              isOverlay ? "text-sm sm:text-base" : "text-base sm:text-lg"
            }`}
          >
            {msg.text}
          </div>
        </div>

        {/* Right Avatar for User */}
        {isUser && (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 shadow-md mb-1"
            style={{ backgroundColor: themeColor }}
          >
            <User size={15} />
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // OVERLAY LAYOUT (Lower-Third Docked Chat Container)
  // ---------------------------------------------------------------------------
  if (effectiveMode === "overlay") {
    return (
      <AbsoluteFill style={displayContainerStyle("overlay")}>
        <div
          style={{
            position: "absolute",
            bottom: 44,
            left: 64,
            maxWidth: 720,
            width: "calc(100% - 128px)",
            opacity: exitOpacity,
            transform: `scale(${exitScale}) translateY(${exitTranslateY}px)`,
          }}
        >
          <div className="flex flex-col gap-1">
            {effectiveMessages.map((msg, idx) => renderBubble(msg, idx, true))}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // ---------------------------------------------------------------------------
  // FULL / TAKEOVER LAYOUT (Center Stage Cinematic Chat Thread)
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
          width: 750,
          height: 550,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${themeColor}30 0%, rgba(30, 58, 138, 0.15) 50%, transparent 75%)`,
          filter: "blur(110px)",
          pointerEvents: "none",
        }}
      />

      {/* Chat Phone / Panel Window */}
      <div
        className="relative z-10 flex flex-col max-w-2xl w-full rounded-3xl bg-slate-950/80 border border-slate-800 shadow-2xl backdrop-blur-2xl overflow-hidden"
        style={{
          opacity: exitOpacity,
          transform: `scale(${exitScale}) translateY(${exitTranslateY}px)`,
          boxShadow: `0 25px 80px rgba(0, 0, 0, 0.8), 0 0 40px ${themeColor}20`,
        }}
      >
        {/* Chat Window Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-950/80 border border-blue-800/60 text-blue-400">
              <MessageSquare size={16} />
            </div>
            <div>
              <div className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
                {rawTitle}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live Interactive Stream</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs font-mono">
            <Sparkles size={13} style={{ color: themeColor }} />
            <span>AI Dialogue</span>
          </div>
        </div>

        {/* Chat Messages Feed */}
        <div className="p-6 flex flex-col gap-2 min-h-[300px] justify-end">
          {effectiveMessages.map((msg, idx) => renderBubble(msg, idx, false))}
        </div>

        {/* Chat Bottom Reply Bar Placeholder */}
        <div className="px-6 py-3 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-between text-xs text-slate-500 font-mono">
          <span>Dialogue in progress...</span>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600 animate-bounce [animation-delay:0.4s]" />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
