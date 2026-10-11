"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Bug,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Search,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Layers,
  Activity,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { DebuggerBeat, DebuggerCandidate, DebuggerJob } from "@/lib/types";

export function FootageDebugger() {
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [expandedBeatId, setExpandedBeatId] = useState<string | null>(null);
  const [overridingBeatId, setOverridingBeatId] = useState<string | null>(null);
  const [overrideSuccess, setOverrideSuccess] = useState<string | null>(null);

  // Fetch recent eligible jobs
  const { data: jobsList, isLoading: isJobsLoading } = useSWR(
    "debugger-jobs",
    () => api.getDebuggerJobs(25),
    { revalidateOnFocus: false }
  );

  const activeJobId = selectedJobId || (jobsList && jobsList.length > 0 ? jobsList[0].id : "");

  // Fetch debug details for selected job
  const {
    data: jobDetail,
    isLoading: isDetailLoading,
    mutate: mutateDetail,
  } = useSWR(
    activeJobId ? ["debugger-job-detail", activeJobId] : null,
    () => api.getJobSelectionDebug(activeJobId),
    { revalidateOnFocus: false }
  );

  const handleOverride = async (beatId: string, chunkId: string) => {
    if (!activeJobId) return;
    setOverridingBeatId(beatId);
    setOverrideSuccess(null);
    try {
      await api.overrideDebuggerSelection(activeJobId, beatId, chunkId);
      setOverrideSuccess(`Successfully set clip #${chunkId.slice(0, 8)} for beat ${beatId}`);
      await mutateDetail();
      setTimeout(() => setOverrideSuccess(null), 4000);
    } catch (err: any) {
      alert(`Override failed: ${err.message || "Unknown error"}`);
    } finally {
      setOverridingBeatId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Job Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Bug className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Footage Selection Debugger</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspect per-beat narration, generated visual intent keywords, candidate scores, and fallback decisions.
            </p>
          </div>
        </div>

        {/* Job Picker Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-medium">Select Job:</label>
          <select
            value={activeJobId}
            onChange={(e) => {
              setSelectedJobId(e.target.value);
              setExpandedBeatId(null);
            }}
            disabled={isJobsLoading}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer min-w-[240px]"
          >
            {jobsList && jobsList.length > 0 ? (
              jobsList.map((j) => (
                <option key={j.id} value={j.id} className="bg-slate-900 text-white">
                  {j.title} ({j.beats_count} beats) • {j.stage}
                </option>
              ))
            ) : (
              <option value="">No jobs found</option>
            )}
          </select>
        </div>
      </div>

      {overrideSuccess && (
        <div className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{overrideSuccess}</span>
        </div>
      )}

      {/* Main Beat-by-Beat Debugger Content */}
      {isDetailLoading ? (
        <div className="flex flex-col items-center justify-center p-16 gap-3 bg-slate-900/40 border border-slate-800 rounded-xl">
          <RotateCw className="w-7 h-7 text-indigo-500 animate-spin" />
          <p className="text-xs text-slate-400">Loading footage candidates and beat rankings...</p>
        </div>
      ) : !jobDetail || !jobDetail.beats || jobDetail.beats.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/30 border border-slate-800 rounded-xl text-slate-500 text-xs">
          No beats or footage candidates found for this job.
        </div>
      ) : (
        <div className="space-y-4">
          {jobDetail.beats.map((beat: DebuggerBeat, bIdx: number) => {
            const isExpanded = expandedBeatId === beat.id || (expandedBeatId === null && bIdx === 0);
            const isAccepted = beat.footage_status === "accepted";
            const isMotionFallback = beat.footage_status === "inadequate" || beat.beat_type !== "narrative";

            return (
              <div
                key={beat.id}
                className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden transition-all shadow-sm"
              >
                {/* Beat Header Bar */}
                <div
                  onClick={() => setExpandedBeatId(isExpanded ? "" : beat.id)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-850 transition-colors"
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-4">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      Beat {bIdx + 1}
                    </span>

                    <div className="flex flex-col min-w-0">
                      <p className="text-sm font-medium text-white truncate max-w-xl">
                        &quot;{beat.text}&quot;
                      </p>
                      {beat.visual_intent && (
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-indigo-400">
                          <Sparkles className="w-3 h-3 shrink-0" />
                          <span className="truncate">Visual Intent: <strong>{beat.visual_intent}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Badges & Toggle */}
                  <div className="flex items-center gap-3 shrink-0">
                    {beat.requery_count > 0 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {beat.requery_count} Requer{beat.requery_count === 1 ? "y" : "ies"}
                      </span>
                    )}

                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                        isAccepted
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : isMotionFallback
                          ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {isAccepted ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Accepted Footage
                        </>
                      ) : isMotionFallback ? (
                        <>
                          <Layers className="w-3 h-3" /> Motion Fallback
                        </>
                      ) : (
                        beat.footage_status
                      )}
                    </span>

                    <button className="text-slate-400 hover:text-white p-1">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-slate-800/80 bg-slate-950/40 space-y-4">
                    {/* Diagnostic Reasons if any */}
                    {(beat.requery_reason || beat.fallback_reason) && (
                      <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-900/40 text-xs space-y-1">
                        {beat.requery_reason && (
                          <p className="text-amber-300">
                            <strong>Requery trigger:</strong> {beat.requery_reason}
                          </p>
                        )}
                        {beat.fallback_reason && (
                          <p className="text-amber-400">
                            <strong>Fallback reason:</strong> {beat.fallback_reason}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Candidate Pool Grid */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Candidate Pool ({beat.candidates.length} retrieved)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Sorted by Semantic Similarity Score
                        </span>
                      </div>

                      {beat.candidates.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-3">
                          No footage candidates returned for this beat.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                          {beat.candidates.map((cand: DebuggerCandidate, cIdx: number) => {
                            const isPicked = cand.is_selected;

                            return (
                              <div
                                key={cand.chunk_id}
                                className={`rounded-xl border overflow-hidden transition-all flex flex-col justify-between ${
                                  isPicked
                                    ? "bg-slate-900 border-indigo-500/80 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-950/20"
                                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                                }`}
                              >
                                <div>
                                  {/* Thumbnail & Badges */}
                                  <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
                                    {cand.storage_url ? (
                                      <video
                                        src={cand.storage_url}
                                        controls
                                        playsInline
                                        className="w-full h-full object-cover"
                                      />
                                    ) : cand.thumbnail_url ? (
                                      <img
                                        src={cand.thumbnail_url}
                                        alt={cand.title || "Candidate shot"}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="text-slate-600">
                                        <Play className="w-5 h-5 mx-auto mb-1 opacity-50" />
                                        <span className="text-[10px]">No Preview</span>
                                      </div>
                                    )}

                                    {/* Pick Badge */}
                                    {isPicked && (
                                      <div className="absolute top-2 left-2 z-10 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                                        Selected Pick
                                      </div>
                                    )}

                                    <div className="absolute top-2 right-2 z-10 bg-black/70 backdrop-blur text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                                      #{cIdx + 1}
                                    </div>
                                  </div>

                                  {/* Info Body */}
                                  <div className="p-3 space-y-2 text-xs">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-slate-200 uppercase text-[10px]">
                                        {cand.provider}
                                      </span>
                                      <span className="text-slate-400 font-mono text-[11px]">
                                        {(cand.duration_sec ?? 0).toFixed(1)}s
                                      </span>
                                    </div>

                                    {/* Score Bars */}
                                    <div className="space-y-1.5 pt-1">
                                      <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-slate-400">Semantic Score:</span>
                                        <span className="font-bold text-white font-mono">
                                          {((cand.score ?? 0) * 100).toFixed(1)}%
                                        </span>
                                      </div>
                                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                        <div
                                          className="bg-indigo-500 h-1.5 rounded-full"
                                          style={{ width: `${Math.min((cand.score ?? 0) * 100, 100)}%` }}
                                        />
                                      </div>

                                      {cand.motion_mean !== undefined && cand.motion_mean !== null && (
                                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                                          <span className="flex items-center gap-1">
                                            <Activity className="w-3 h-3 text-emerald-400" />
                                            Motion:
                                          </span>
                                          <span className="font-mono text-slate-300">
                                            {Number(cand.motion_mean).toFixed(1)}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Override Action Button */}
                                <div className="p-3 pt-0">
                                  {isPicked ? (
                                    <div className="w-full py-1.5 text-center text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center gap-1">
                                      <Check className="w-3.5 h-3.5" /> Chosen
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleOverride(beat.id, cand.chunk_id)}
                                      disabled={overridingBeatId === beat.id}
                                      className="w-full py-1.5 px-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors border border-slate-700 flex items-center justify-center gap-1.5"
                                    >
                                      {overridingBeatId === beat.id ? (
                                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        "Pick this Shot"
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
