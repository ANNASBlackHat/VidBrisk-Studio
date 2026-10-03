"use client";

import React, { useState } from "react";
import {
  Beat,
  BeatType,
  JobResponse,
} from "@/lib/types";
import { api } from "@/lib/api";
import {
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
  Video,
  BarChart2,
  Quote,
  Type,
  Layers,
  MessageSquare,
  Columns,
} from "lucide-react";

interface ScriptReviewProps {
  job: JobResponse;
  onApproved: () => void;
}

export function ScriptReview({ job, onApproved }: ScriptReviewProps) {
  const [beats, setBeats] = useState<Beat[]>(() => {
    if (job.beats && job.beats.length > 0) {
      return JSON.parse(JSON.stringify(job.beats));
    }
    return [
      {
        id: "b1",
        text: job.clean_script || job.raw_input,
        visual_intent: "Dynamic cinematic visuals illustrating narration",
        beat_type: "narrative",
      },
    ];
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUpdateBeat = (index: number, field: keyof Beat, value: unknown) => {
    const updated = [...beats];
    updated[index] = { ...updated[index], [field]: value };
    setBeats(updated);
  };

  const handleAddBeat = () => {
    const nextId = `b${beats.length + 1}`;
    setBeats([
      ...beats,
      {
        id: nextId,
        text: "",
        visual_intent: "",
        beat_type: "narrative",
        pause_after: 0,
      },
    ]);
  };

  const handleRemoveBeat = (index: number) => {
    if (beats.length <= 1) return;
    const filtered = beats.filter((_, i) => i !== index);
    setBeats(filtered);
  };

  const handleApprove = async () => {
    // Validate beats
    const invalid = beats.some((b) => !b.text.trim());
    if (invalid) {
      setErrorMsg("All beats must have narration text before continuing.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await api.approveJob(job.id, {
        action: "approve",
        beats_override: beats,
      });
      onApproved();
    } catch (err: unknown) {
      console.error("Failed to approve script:", err);
      const msg = err instanceof Error ? err.message : "Failed to approve script.";
      setErrorMsg(msg);
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!confirm("Are you sure you want to reject this job run?")) return;
    setIsRejecting(true);
    try {
      await api.approveJob(job.id, { action: "reject" });
      onApproved();
    } catch (err: unknown) {
      console.error("Failed to reject job:", err);
      setIsRejecting(false);
    }
  };

  const getBeatTypeBadge = (beat: Beat) => {
    const comp = (beat.motion_props?.component as string) || "";
    const layout = (beat.motion_props?.layout_recipe as string) || "";
    const type = beat.beat_type;

    if (type === "split_screen" || layout === "split_screen" || comp.includes("SplitScreen")) {
      return {
        icon: <Columns className="w-3.5 h-3.5 text-orange-400" />,
        color: "bg-orange-950/60 text-orange-300 border-orange-800",
        label: "Split Screen",
      };
    }
    if (type === "swipe_deck" || comp.includes("SwipeDeck")) {
      return {
        icon: <Layers className="w-3.5 h-3.5 text-emerald-400" />,
        color: "bg-emerald-950/60 text-emerald-300 border-emerald-800",
        label: "Swipe Deck",
      };
    }
    if (type === "chat_bubbles" || comp.includes("ChatBubbles")) {
      return {
        icon: <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />,
        color: "bg-indigo-950/60 text-indigo-300 border-indigo-800",
        label: "Chat Bubbles",
      };
    }
    if (type === "kinetic" || comp.includes("KineticText")) {
      return {
        icon: <Type className="w-3.5 h-3.5 text-pink-400" />,
        color: "bg-pink-950/60 text-pink-300 border-pink-800",
        label: "Kinetic Text",
      };
    }
    if (type === "typewriter" || comp.includes("Typewriter")) {
      return {
        icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" />,
        color: "bg-amber-950/60 text-amber-300 border-amber-800",
        label: "Typewriter",
      };
    }
    if (type === "stat" || comp.includes("StatCard")) {
      return {
        icon: <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />,
        color: "bg-cyan-950/60 text-cyan-300 border-cyan-800",
        label: "Stat Card",
      };
    }
    if (type === "quote" || type === "abstract" || comp.includes("QuoteCard")) {
      return {
        icon: <Quote className="w-3.5 h-3.5 text-purple-400" />,
        color: "bg-purple-950/60 text-purple-300 border-purple-800",
        label: "Quote Card",
      };
    }

    return {
      icon: <Video className="w-3.5 h-3.5 text-blue-400" />,
      color: "bg-blue-950/60 text-blue-300 border-blue-800",
      label: "Footage Narrative",
    };
  };

  const getEffectiveSelection = (beat: Beat): string => {
    const comp = (beat.motion_props?.component as string) || "";
    const layout = (beat.motion_props?.layout_recipe as string) || "";
    const type = beat.beat_type;

    if (type === "split_screen" || layout === "split_screen" || comp.includes("SplitScreen")) return "split_screen";
    if (type === "swipe_deck" || comp.includes("SwipeDeck")) return "swipe_deck";
    if (type === "chat_bubbles" || comp.includes("ChatBubbles")) return "chat_bubbles";
    if (type === "kinetic" || comp.includes("KineticText")) return "kinetic";
    if (type === "typewriter" || comp.includes("Typewriter")) return "typewriter";
    if (type === "stat" || comp.includes("StatCard")) return "stat";
    if (type === "quote" || comp.includes("QuoteCard")) return "quote";
    if (type === "abstract") return "quote";
    return "narrative";
  };

  const handleSelectVisualType = (index: number, selected: string) => {
    const updated = [...beats];
    const current = updated[index];

    switch (selected) {
      case "narrative":
        updated[index] = {
          ...current,
          beat_type: "narrative",
          motion_props: null,
        };
        break;
      case "stat":
        updated[index] = {
          ...current,
          beat_type: "stat",
          motion_props: {
            component: "DataAnimations/StatCard",
            primary_value: (current.text.match(/(\$?\d+(?:\.\d+)?\s*(?:billion|million|thousand|percent|%|k|m|b)?|\d+%)/i)?.[0] || "$25.4B").toUpperCase(),
            kicker: "KEY METRIC",
            visual_type: "chart",
            subtext: current.text,
            display_mode: "overlay",
          },
        };
        break;
      case "quote":
        updated[index] = {
          ...current,
          beat_type: "abstract",
          motion_props: {
            component: "TextAnimations/QuoteCard",
            quote: current.text,
            emphasis: current.text.split(" ").slice(0, 4).join(" "),
            author: "Retrospective",
            display_mode: "overlay",
          },
        };
        break;
      case "kinetic":
        updated[index] = {
          ...current,
          beat_type: "abstract",
          motion_props: {
            component: "TextAnimations/KineticText",
            text: current.text,
            mode: "reveal",
            display_mode: "takeover",
            themeColor: "#38bdf8",
          },
        };
        break;
      case "typewriter":
        updated[index] = {
          ...current,
          beat_type: "abstract",
          motion_props: {
            component: "TextAnimations/Typewriter",
            text: current.text,
            display_mode: "takeover",
          },
        };
        break;
      case "swipe_deck":
        updated[index] = {
          ...current,
          beat_type: "abstract",
          motion_props: {
            component: "ListAnimations/SwipeDeck",
            title: "KEY HIGHLIGHTS",
            items: current.text.split(/[.;]\s+/).filter(Boolean).slice(0, 4),
            display_mode: "takeover",
            themeColor: "#38bdf8",
          },
        };
        break;
      case "chat_bubbles":
        updated[index] = {
          ...current,
          beat_type: "abstract",
          motion_props: {
            component: "ListAnimations/ChatBubbles",
            title: "CONVERSATION THREAD",
            messages: [
              { text: current.text, sender: "system" },
            ],
            display_mode: "takeover",
            themeColor: "#3b82f6",
          },
        };
        break;
      case "split_screen":
        updated[index] = {
          ...current,
          beat_type: "narrative",
          motion_props: {
            layout_recipe: "split_screen",
            component: "Layouts/SplitScreen",
            leftTitle: "Initial Phase",
            leftContent: current.text.slice(0, 35),
            rightTitle: "Outcome",
            rightContent: "Target Realized",
          },
        };
        break;
      default:
        updated[index] = {
          ...current,
          beat_type: "narrative",
          motion_props: null,
        };
    }
    setBeats(updated);
  };

  return (
    <div className="flex flex-col gap-6 p-6 rounded-2xl bg-amber-950/20 border border-amber-800/60 shadow-xl shadow-amber-950/10">
      {/* Checkpoint Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-amber-800/40">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-900/40 border border-amber-700/60 text-amber-300 shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-amber-200">
                Checkpoint 1: Review Beat Structure
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-amber-900/60 text-amber-300 border border-amber-700">
                Human-in-the-loop
              </span>
            </div>
            <p className="text-xs text-amber-300/80 mt-1 max-w-2xl">
              The AI segmented your script into {beats.length} beats and tagged their visual intent.
              You can tweak narration wording, adjust visual search queries, or change beat types before voice synthesis begins.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <button
            onClick={handleReject}
            disabled={isRejecting || isSubmitting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/60 transition-colors"
          >
            {isRejecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            <span>Reject Job</span>
          </button>

          <button
            onClick={handleApprove}
            disabled={isSubmitting || isRejecting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 shadow-md shadow-amber-400/20 active:scale-95 transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Advancing to Voice Synthesis...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve Script & Continue</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Clean Narration Overview */}
      {job.clean_script && (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-400 block mb-1">
            Clean Spoken Script (Stage 1 Output)
          </span>
          <p className="font-sans leading-relaxed text-slate-200">{job.clean_script}</p>
        </div>
      )}

      {/* Beats List */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Structured Beats ({beats.length})</span>
          </span>
          <button
            type="button"
            onClick={handleAddBeat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-amber-300 hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Beat</span>
          </button>
        </div>

        {beats.map((beat, idx) => {
          const badge = getBeatTypeBadge(beat);
          const currentVisual = getEffectiveSelection(beat);
          return (
            <div
              key={beat.id || idx}
              className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    Beat #{idx + 1} ({beat.id})
                  </span>

                  {/* Visual Style & Motion Component Selector */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <select
                      value={currentVisual}
                      onChange={(e) =>
                        handleSelectVisualType(idx, e.target.value)
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <optgroup label="Footage & Video">
                        <option value="narrative">Narrative (Footage / B-Roll)</option>
                        <option value="split_screen">Split Screen (Dual Comparison)</option>
                      </optgroup>
                      <optgroup label="Motion Graphics & Data">
                        <option value="stat">Stat Card (Data & Metrics)</option>
                        <option value="quote">Quote Card (Featured Quotes)</option>
                        <option value="kinetic">Kinetic Typography (Dynamic Reveal)</option>
                        <option value="typewriter">Typewriter Narration</option>
                      </optgroup>
                      <optgroup label="List & Dialogue Reveals">
                        <option value="swipe_deck">Card Swipe Deck (Stacked List)</option>
                        <option value="chat_bubbles">Chat Bubble Reveal (Dialogue)</option>
                      </optgroup>
                    </select>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border font-medium ${badge.color}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>
                  </div>
                </div>

                {beats.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveBeat(idx)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                    title="Remove beat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Beat Narration Text */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">
                  Narration Text (Spoken by TTS):
                </label>
                <textarea
                  rows={2}
                  value={beat.text}
                  onChange={(e) => handleUpdateBeat(idx, "text", e.target.value)}
                  placeholder="Narration words for this beat..."
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500/80 font-sans"
                />
              </div>

              {/* Visual Intent Query */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400">
                  Visual Search Intent (Query for Footage Engine / Motion Card):
                </label>
                <input
                  type="text"
                  value={beat.visual_intent}
                  onChange={(e) =>
                    handleUpdateBeat(idx, "visual_intent", e.target.value)
                  }
                  placeholder="e.g. Saturn V rocket lifting off with massive fire plume"
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-amber-500/80 font-mono"
                />
              </div>

              {/* Breathing Room / Pause After Beat */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="text-amber-400 font-mono">⏸️</span>
                  <span className="font-medium text-slate-300">Breathing Room / Pause After:</span>
                  <span className="text-[10px] text-slate-500 hidden sm:inline">
                    (silence on narration, visuals & BGM continue)
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[0, 1.0, 1.5, 2.0].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleUpdateBeat(idx, "pause_after", preset)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors ${
                        (beat.pause_after || 0) === preset
                          ? "bg-amber-400/20 text-amber-300 border border-amber-500/40"
                          : "bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {preset === 0 ? "None" : `${preset}s`}
                    </button>
                  ))}
                  <div className="flex items-center gap-1 ml-1">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="10"
                      value={beat.pause_after ?? 0}
                      onChange={(e) =>
                        handleUpdateBeat(
                          idx,
                          "pause_after",
                          Math.max(0, parseFloat(e.target.value) || 0)
                        )
                      }
                      className="w-14 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-200 text-center font-mono focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] text-slate-500 font-mono">sec</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
