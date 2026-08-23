"use client";

import React, { useState } from "react";
import { Player } from "@remotion/player";
import {
  MOTION_COMPONENTS,
  StatCard,
  Typewriter,
  QuoteCard,
  StandardCard,
  SplitScreen,
  SwipeDeck,
  ChatBubbles,
} from "./registry";
import { Sparkles, Layers } from "lucide-react";

export function MotionGallery() {
  const [selectedKey, setSelectedKey] = useState<string>("DataAnimations/StatCard");

  const [statValue, setStatValue] = useState("$25B");
  const [statLabel, setStatLabel] = useState("Total Apollo Cost");
  const [statVisualType, setStatVisualType] = useState<"ring" | "bar">("bar");
  const [statSubtext, setStatSubtext] = useState("4% of the United States Federal Budget");

  const [typewriterText, setTypewriterText] = useState(
    "In July 1969, three astronauts embarked on humanity's most daring voyage to the Moon."
  );

  const [quoteText, setQuoteText] = useState(
    "Its true value was not measured in dollars, but in proving that the impossible was within reach."
  );
  const [quoteEmphasis, setQuoteEmphasis] = useState("the impossible was within reach");

  const [swipeItemsText, setSwipeItemsText] = useState(
    "1. Saturn V Launch Stage\n2. Translunar Injection Burn\n3. Lunar Module Descent\n4. Surface Exploration EVA"
  );

  const [chatMessagesText, setChatMessagesText] = useState(
    "AI: Houston, all telemetry streams are optimal.\nUser: Copy that. Proceeding with lunar orbital insertion.\nAI: Main propulsion firing initiated for 350 seconds.\nUser: Trajectory lock confirmed."
  );

  const renderSelectedComponent = () => {
    switch (selectedKey) {
      case "DataAnimations/StatCard":
        return (
          <StatCard
            value={statValue}
            label={statLabel}
            visualType={statVisualType}
            durationInFrames={180}
            subtext={statSubtext}
            themeColor="#3b82f6"
          />
        );
      case "TextAnimations/Typewriter":
        return <Typewriter text={typewriterText} />;
      case "TextAnimations/QuoteCard":
        return (
          <QuoteCard
            quote={quoteText}
            emphasis={quoteEmphasis}
            author="Apollo 11 Retrospective"
          />
        );
      case "ListAnimations/SwipeDeck": {
        const items = swipeItemsText
          .split("\n")
          .map((line) => line.replace(/^\d+[\.\)]\s*/, "").trim())
          .filter(Boolean);
        return (
          <SwipeDeck
            items={items}
            durationInFrames={180}
            themeColor="#38bdf8"
            title="MISSION TIMELINE"
            layoutRole="takeover"
          />
        );
      }
      case "ListAnimations/ChatBubbles": {
        const messages = chatMessagesText
          .split("\n")
          .filter((l) => l.trim())
          .map((line) => {
            const isUser = line.toLowerCase().startsWith("user:");
            const text = line.replace(/^(ai|user|system):\s*/i, "").trim();
            return {
              text,
              sender: isUser ? ("user" as const) : ("system" as const),
            };
          });
        return (
          <ChatBubbles
            messages={messages}
            durationInFrames={180}
            themeColor="#3b82f6"
            title="MISSION CONTROL DIALOGUE"
            layoutRole="takeover"
          />
        );
      }
      case "Layouts/SplitScreen":
        return (
          <SplitScreen
            leftTitle="Initial Budget"
            leftContent="$7 Billion Target"
            rightTitle="Actual Expenditure"
            rightContent="$25.4 Billion Realized"
          />
        );
      default:
        return <StandardCard text={quoteText} title="Mission Briefing" />;
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 rounded-2xl bg-slate-900/60 border border-slate-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-950/80 border border-blue-800 text-blue-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              Motion Component Registry Showcase
            </h3>
            <p className="text-xs text-slate-400">
              Interactive preview of vendored Remotion motion graphics components.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {Object.keys(MOTION_COMPONENTS).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedKey(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                selectedKey === key
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {key.split("/")[1]}
            </button>
          ))}
        </div>
      </div>

      {/* Remotion Player Preview Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 relative aspect-video rounded-2xl bg-black border border-slate-800 overflow-hidden shadow-2xl">
          <Player
            component={() => renderSelectedComponent()}
            durationInFrames={180}
            fps={30}
            compositionWidth={1280}
            compositionHeight={720}
            style={{ width: "100%", height: "100%" }}
            controls
            autoPlay
            loop
          />
        </div>

        {/* Live Prop Controls */}
        <div className="flex flex-col gap-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
          <span className="font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Interactive Props Inspector</span>
          </span>

          {selectedKey === "DataAnimations/StatCard" && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Visual Metaphor:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatVisualType("bar")}
                    className={`py-1.5 px-2 rounded-lg text-xs font-mono font-medium transition-all ${
                      statVisualType === "bar"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
                    }`}
                  >
                    Progress Bar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatVisualType("ring");
                      if (!statValue.includes("%")) {
                        setStatValue("75%");
                      }
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-mono font-medium transition-all ${
                      statVisualType === "ring"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
                    }`}
                  >
                    Radial Ring
                  </button>
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Value / Metric:</label>
                <input
                  type="text"
                  value={statValue}
                  onChange={(e) => setStatValue(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Label / Title:</label>
                <input
                  type="text"
                  value={statLabel}
                  onChange={(e) => setStatLabel(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Subtext / Explanation:</label>
                <textarea
                  rows={3}
                  value={statSubtext}
                  onChange={(e) => setStatSubtext(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200"
                />
              </div>
            </div>
          )}

          {selectedKey === "TextAnimations/Typewriter" && (
            <div>
              <label className="text-slate-400 block mb-1">Typewriter Narration:</label>
              <textarea
                rows={4}
                value={typewriterText}
                onChange={(e) => setTypewriterText(e.target.value)}
                className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200"
              />
            </div>
          )}

          {selectedKey === "TextAnimations/QuoteCard" && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Quote Text:</label>
                <textarea
                  rows={3}
                  value={quoteText}
                  onChange={(e) => setQuoteText(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Highlight / Emphasis Phrase:</label>
                <input
                  type="text"
                  value={quoteEmphasis}
                  onChange={(e) => setQuoteEmphasis(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200"
                />
              </div>
            </div>
          )}

          {selectedKey === "ListAnimations/SwipeDeck" && (
            <div>
              <label className="text-slate-400 block mb-1">Swipe Deck Items (one per line):</label>
              <textarea
                rows={5}
                value={swipeItemsText}
                onChange={(e) => setSwipeItemsText(e.target.value)}
                className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs"
              />
            </div>
          )}

          {selectedKey === "ListAnimations/ChatBubbles" && (
            <div>
              <label className="text-slate-400 block mb-1">Chat Messages (format: Sender: Text):</label>
              <textarea
                rows={5}
                value={chatMessagesText}
                onChange={(e) => setChatMessagesText(e.target.value)}
                className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
