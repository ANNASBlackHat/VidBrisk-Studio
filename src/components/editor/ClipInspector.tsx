"use client";

import React from "react";
import {
  EditorClip,
} from "@/adapters/timelineToEditorState";
import {
  Sparkles,
  Film,
  Layers,
  ArrowRightLeft,
  Clock,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { formatDuration } from "@/lib/utils";

interface ClipInspectorProps {
  selectedClip: EditorClip | null;
  onUpdateClipProps: (clipId: string, newProps: Record<string, unknown>) => void;
  onUpdateClipTiming: (clipId: string, sourceIn: number, sourceOut: number) => void;
  onSwapCandidate: (clipId: string, candidateIndex: number) => void;
  onDeleteClip: (clipId: string) => void;
}

export function ClipInspector({
  selectedClip,
  onUpdateClipProps,
  onUpdateClipTiming,
  onSwapCandidate,
  onDeleteClip,
}: ClipInspectorProps) {
  if (!selectedClip) {
    return (
      <div className="w-80 h-full p-6 border-l border-slate-800 bg-slate-900/40 flex flex-col items-center justify-center text-center text-slate-500 text-xs">
        <Layers className="w-8 h-8 text-slate-600 mb-2" />
        <p className="font-semibold text-slate-400">No Clip Selected</p>
        <p className="mt-1 max-w-xs">
          Click any clip on the timeline tracks below to inspect properties, tweak motion graphics, or swap footage candidates.
        </p>
      </div>
    );
  }

  const isMotion = selectedClip.assetType === "motion";
  const isVideo = selectedClip.assetType === "video";
  const candidates = selectedClip.candidates || [];

  return (
    <div className="w-80 h-full p-5 border-l border-slate-800 bg-slate-900/60 overflow-y-auto flex flex-col gap-5 text-xs">
      {/* Clip Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {isMotion ? (
            <div className="p-1.5 rounded-lg bg-purple-950 border border-purple-800 text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1.5 rounded-lg bg-blue-950 border border-blue-800 text-blue-400">
              <Film className="w-4 h-4" />
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-bold text-slate-200 font-mono truncate max-w-[140px]">
              {selectedClip.id}
            </span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
              {isMotion ? selectedClip.componentId : "Footage Clip"}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDeleteClip(selectedClip.id)}
          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
          title="Delete clip"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Timing Inspector */}
      <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
        <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-400 flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-blue-400" />
          <span>Timeline Placement</span>
        </span>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-1">
          <div>
            <label className="text-[10px] text-slate-500 block">Start:</label>
            <span className="text-slate-300 font-semibold">
              {formatDuration(selectedClip.trackStart)}
            </span>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block">End:</label>
            <span className="text-slate-300 font-semibold">
              {formatDuration(selectedClip.trackEnd)}
            </span>
          </div>
          <div className="col-span-2 pt-1 border-t border-slate-900 flex justify-between">
            <span className="text-[10px] text-slate-500">Duration:</span>
            <span className="text-blue-400 font-semibold">
              {selectedClip.duration.toFixed(2)}s
            </span>
          </div>
        </div>
      </div>

      {/* Motion Graphics Live Props Inspector */}
      {isMotion && (
        <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-purple-300 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>Motion Component Props</span>
          </span>

          {/* StatCard specific fields */}
          {selectedClip.componentId?.includes("StatCard") && (
            <>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Metric Value:
                </label>
                <input
                  type="text"
                  value={String(selectedClip.props?.value || "$25B")}
                  onChange={(e) =>
                    onUpdateClipProps(selectedClip.id, {
                      ...selectedClip.props,
                      value: e.target.value,
                    })
                  }
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Label:
                </label>
                <input
                  type="text"
                  value={String(selectedClip.props?.label || "")}
                  onChange={(e) =>
                    onUpdateClipProps(selectedClip.id, {
                      ...selectedClip.props,
                      label: e.target.value,
                    })
                  }
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Subtext:
                </label>
                <textarea
                  rows={2}
                  value={String(selectedClip.props?.subtext || "")}
                  onChange={(e) =>
                    onUpdateClipProps(selectedClip.id, {
                      ...selectedClip.props,
                      subtext: e.target.value,
                    })
                  }
                  className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-purple-500"
                />
              </div>
            </>
          )}

          {/* Typewriter / QuoteCard generic text */}
          {!selectedClip.componentId?.includes("StatCard") && (
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                Display Text:
              </label>
              <textarea
                rows={3}
                value={String(
                  selectedClip.props?.text ||
                    selectedClip.props?.quote ||
                    selectedClip.rawContent ||
                    ""
                )}
                onChange={(e) =>
                  onUpdateClipProps(selectedClip.id, {
                    ...selectedClip.props,
                    text: e.target.value,
                    quote: e.target.value,
                  })
                }
                className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-purple-500"
              />
            </div>
          )}
        </div>
      )}

      {/* Video Clip Trimming Inspector */}
      {isVideo && (
        <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-400 flex items-center gap-1.5">
            <Film className="w-3 h-3 text-blue-400" />
            <span>Footage Source Trimming</span>
          </span>

          <div className="grid grid-cols-2 gap-2 font-mono">
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">
                Source In (sec):
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={selectedClip.sourceIn || 0}
                onChange={(e) =>
                  onUpdateClipTiming(
                    selectedClip.id,
                    parseFloat(e.target.value) || 0,
                    selectedClip.sourceOut || selectedClip.duration
                  )
                }
                className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-1">
                Source Out (sec):
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={selectedClip.sourceOut || selectedClip.duration}
                onChange={(e) =>
                  onUpdateClipTiming(
                    selectedClip.id,
                    selectedClip.sourceIn || 0,
                    parseFloat(e.target.value) || selectedClip.duration
                  )
                }
                className="w-full p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-xs font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* Alternative Shortlist Candidates Panel (if available) */}
      {candidates.length > 1 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-400 flex items-center gap-1.5">
            <ArrowRightLeft className="w-3 h-3 text-blue-400" />
            <span>Swap Alternative Candidate</span>
          </span>

          <div className="flex flex-col gap-2 mt-1">
            {candidates.slice(1).map((cand, idx) => {
              const candDuration =
                cand.duration ??
                Math.max(0, (cand.source_out ?? 0) - (cand.source_in ?? 0));

              return (
                <div
                  key={cand.chunk_id || idx}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-blue-500/50 flex flex-col gap-1.5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-slate-300 font-semibold truncate">
                      Candidate #{idx + 2}
                    </span>
                    {(cand.score || cand.similarity) && (
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">
                        {Math.round(((cand.score || cand.similarity) || 0) * 100)}%
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>Duration: {candDuration.toFixed(1)}s</span>
                    <button
                      type="button"
                      onClick={() => onSwapCandidate(selectedClip.id, idx + 1)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-sans text-[11px] font-medium transition-colors"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Select</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
