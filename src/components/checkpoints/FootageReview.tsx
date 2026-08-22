"use client";

import React, { useState } from "react";
import {
  FootageCandidate,
  JobResponse,
} from "@/lib/types";
import { api } from "@/lib/api";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  Film,
  Sparkle,
  Layers,
  ArrowRightLeft,
  Clock,
  Percent,
} from "lucide-react";
import { formatDuration } from "@/lib/utils";

interface FootageReviewProps {
  job: JobResponse;
  onApproved: () => void;
}

export function FootageReview({ job, onApproved }: FootageReviewProps) {
  // Map of beat_id -> list of candidates (sorted with selected candidate at index 0)
  const [candidatesMap, setCandidatesMap] = useState<
    Record<string, FootageCandidate[]>
  >(() => {
    if (job.footage_candidates) {
      return JSON.parse(JSON.stringify(job.footage_candidates));
    }
    return {};
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const beats = job.beats || [];

  const handleSwapCandidate = (beatId: string, candidateIndex: number) => {
    const list = candidatesMap[beatId] ? [...candidatesMap[beatId]] : [];
    if (candidateIndex < 0 || candidateIndex >= list.length) return;

    // Move selected candidate to index 0 (top pick)
    const selected = list.splice(candidateIndex, 1)[0];
    list.unshift(selected);

    setCandidatesMap({
      ...candidatesMap,
      [beatId]: list,
    });
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await api.approveJob(job.id, {
        action: "approve",
        candidates_override: candidatesMap,
      });
      onApproved();
    } catch (err: unknown) {
      console.error("Failed to approve footage:", err);
      const msg = err instanceof Error ? err.message : "Failed to approve footage matches.";
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

  return (
    <div className="flex flex-col gap-6 p-6 rounded-2xl bg-amber-950/20 border border-amber-800/60 shadow-xl shadow-amber-950/10">
      {/* Checkpoint Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-amber-800/40">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-900/40 border border-amber-700/60 text-amber-300 shrink-0 mt-0.5">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-amber-200">
                Checkpoint 2: Review Footage & Fallbacks
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-amber-900/60 text-amber-300 border border-amber-700">
                Human-in-the-loop
              </span>
            </div>
            <p className="text-xs text-amber-300/80 mt-1 max-w-2xl">
              Inspect the candidate footage retrieved for each beat from the Footage Engine.
              You can swap the top pick with any alternative candidate, or see which beats fell back to motion graphics before timeline assembly.
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
                <span>Assembling Timeline...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve Footage & Assemble</span>
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

      {/* Beats & Footage Match List */}
      <div className="flex flex-col gap-6">
        {beats.map((beat, idx) => {
          const candidates = candidatesMap[beat.id] || [];
          const topCandidate = candidates[0];
          const hasFootage =
            topCandidate &&
            (topCandidate.storage_path || topCandidate.storage_url) &&
            topCandidate.storage_url !== "";
          const timing = job.timings ? job.timings[beat.id] : null;
          const voDuration = timing?.duration || 5.0;
          const topDuration = topCandidate
            ? topCandidate.duration ??
              Math.max(0, (topCandidate.source_out ?? 0) - (topCandidate.source_in ?? 0))
            : 0;

          return (
            <div
              key={beat.id || idx}
              className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col gap-4"
            >
              {/* Beat Info Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded font-mono text-xs font-bold bg-slate-800 text-slate-200 border border-slate-700">
                    Beat #{idx + 1} ({beat.id})
                  </span>
                  <span className="text-xs text-slate-300 font-medium">
                    &quot;{beat.text}&quot;
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    VO: {voDuration.toFixed(1)}s
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-slate-800 border border-slate-700">
                    {beat.beat_type}
                  </span>
                </div>
              </div>

              {/* Visual Intent Query */}
              <div className="text-xs text-slate-400 font-mono bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 font-semibold uppercase text-[10px] mr-2">
                  Search Query:
                </span>
                {beat.visual_intent}
              </div>

              {/* Top Selected Candidate */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Selected Visual Asset (Primary Pick)</span>
                </span>

                {hasFootage ? (
                  <div className="flex flex-col md:flex-row gap-4 p-3.5 rounded-xl bg-slate-950/80 border border-blue-500/40">
                    {/* Video preview / thumbnail */}
                    <div className="relative w-full md:w-56 h-32 rounded-lg bg-slate-900 overflow-hidden border border-slate-800 shrink-0 flex items-center justify-center">
                      <video
                        src={topCandidate.storage_url || topCandidate.storage_path}
                        className="w-full h-full object-cover"
                        controls
                        muted
                      />
                    </div>

                    {/* Candidate Details */}
                    <div className="flex flex-col justify-between flex-1 gap-2">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-semibold text-slate-200 truncate">
                            Chunk ID: {topCandidate.chunk_id}
                          </span>
                          {(topCandidate.score || topCandidate.similarity) && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                              <Percent className="w-3 h-3 text-emerald-400" />
                              {Math.round(((topCandidate.score || topCandidate.similarity) || 0) * 100)}% Match
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-1">
                          <span>
                            Clip Duration: {topDuration.toFixed(1)}s
                          </span>
                          <span>•</span>
                          <span>
                            Source Range: {formatDuration(topCandidate.source_in ?? 0)} → {formatDuration(topCandidate.source_out ?? topDuration)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Ready for assembly duration-matching</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Motion Graphics Fallback Card */
                  <div className="flex items-center justify-between p-4 rounded-xl bg-purple-950/20 border border-purple-800/50 text-purple-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-purple-900/40 border border-purple-700/60 text-purple-300">
                        <Sparkle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-purple-200">
                            Motion Graphics Fallback Triggered
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-mono bg-purple-900/60 text-purple-300 border border-purple-700">
                            {beat.beat_type === "stat"
                              ? "StatCard Component"
                              : "Typewriter / QuoteCard"}
                          </span>
                        </div>
                        <p className="text-[11px] text-purple-300/80 mt-0.5">
                          No matching video clip exceeded similarity threshold. Pipeline will compile an animated motion component for this beat.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Shortlist Alternatives Switcher (if > 1 candidate) */}
              {candidates.length > 1 && (
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/60">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Layers className="w-3 h-3 text-slate-400" />
                    <span>Alternative Shortlist Candidates ({candidates.length - 1} options)</span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {candidates.slice(1).map((altCand, altIdx) => {
                      const altDuration =
                        altCand.duration ??
                        Math.max(0, (altCand.source_out ?? 0) - (altCand.source_in ?? 0));

                      return (
                        <div
                          key={altCand.chunk_id || altIdx}
                          className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 flex flex-col justify-between gap-2"
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-[11px] text-slate-300 truncate">
                                Option #{altIdx + 2}
                              </span>
                              {(altCand.score || altCand.similarity) && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  {Math.round(((altCand.score || altCand.similarity) || 0) * 100)}%
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Duration: {altDuration.toFixed(1)}s
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSwapCandidate(beat.id, altIdx + 1)}
                            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded bg-slate-900 hover:bg-blue-600 text-slate-300 hover:text-white border border-slate-800 hover:border-blue-500 text-xs font-medium transition-colors"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>Swap to Primary</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
