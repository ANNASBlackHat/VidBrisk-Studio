"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  RotateCcw,
  Film,
  AlertCircle,
  Code,
  ChevronDown,
  ChevronUp,
  Monitor,
  Smartphone,
  Square,
  Sparkles,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { JobResponse, STAGE_CONFIGS, TargetOrientation } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ScriptReview } from "@/components/checkpoints/ScriptReview";
import { FootageReview } from "@/components/checkpoints/FootageReview";
import { formatDate } from "@/lib/utils";

export default function JobProgressPage() {
  const params = useParams();
  const jobId = params.id as string;

  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  // Poll job status every 2.5 seconds, but stop polling if awaiting approval, done, or failed
  const {
    data: job,
    error,
    isLoading,
    mutate,
  } = useSWR<JobResponse>(
    jobId ? `job-${jobId}` : null,
    () => api.getJob(jobId),
    {
      refreshInterval: (latestData) => {
        if (!latestData) return 2500;
        if (
          latestData.status === "awaiting_approval" ||
          latestData.status === "complete" ||
          latestData.stage === "done" ||
          latestData.stage === "failed" ||
          latestData.status === "failed"
        ) {
          return 0; // Stop automatic polling
        }
        return 2500;
      },
      revalidateOnFocus: true,
    }
  );

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await api.retryJob(jobId);
      await mutate();
    } catch (err) {
      console.error("Retry failed:", err);
    } finally {
      setIsRetrying(false);
    }
  };

  const getOrientationIcon = (orientation?: TargetOrientation) => {
    switch (orientation) {
      case "vertical":
        return <Smartphone className="w-3.5 h-3.5" />;
      case "square":
        return <Square className="w-3.5 h-3.5" />;
      default:
        return <Monitor className="w-3.5 h-3.5" />;
    }
  };

  if (isLoading && !job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Loading pipeline state...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8 text-center bg-rose-950/20 border border-rose-900/40 rounded-2xl">
        <AlertCircle className="w-10 h-10 text-rose-400" />
        <h2 className="text-lg font-bold text-slate-100">Job Not Found</h2>
        <p className="text-xs text-slate-400 max-w-sm">
          Could not retrieve job with ID &quot;{jobId}&quot;. Ensure the backend server is running and the job exists.
        </p>
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
    );
  }

  const isDone = job.stage === "done" || job.status === "complete";
  const isAwaitingApproval = job.status === "awaiting_approval";
  const isFailed = job.stage === "failed" || job.status === "failed";

  // Determine current active step number (1 to 7)
  const currentStageConfig = STAGE_CONFIGS.find((s) => s.key === job.stage);
  const currentStepNumber = isDone ? 8 : currentStageConfig?.stepNumber || 1;

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
      {/* Top Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex flex-col gap-1">
            {isEditingTitle ? (
              <div className="flex items-center gap-2 max-w-md">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && titleInput.trim()) {
                      setIsSavingTitle(true);
                      try {
                        await api.updateJob(jobId, { title: titleInput.trim() });
                        await mutate();
                        setIsEditingTitle(false);
                      } catch (err) {
                        console.error("Failed to update title", err);
                      } finally {
                        setIsSavingTitle(false);
                      }
                    } else if (e.key === "Escape") {
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  disabled={isSavingTitle}
                  className="px-2.5 py-1 text-sm bg-slate-950 border border-blue-500 rounded-md text-white focus:outline-none flex-1 font-medium"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!titleInput.trim()) return;
                    setIsSavingTitle(true);
                    try {
                      await api.updateJob(jobId, { title: titleInput.trim() });
                      await mutate();
                      setIsEditingTitle(false);
                    } catch (err) {
                      console.error("Failed to update title", err);
                    } finally {
                      setIsSavingTitle(false);
                    }
                  }}
                  disabled={isSavingTitle}
                  className="p-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(false)}
                  disabled={isSavingTitle}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group/title">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>{job.title || `Job #${job.id.slice(0, 8)}`}</span>
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setTitleInput(job.title || `Job #${job.id.slice(0, 8)}`);
                    setIsEditingTitle(true);
                  }}
                  className="opacity-0 group-hover/title:opacity-100 p-1 text-slate-500 hover:text-slate-200 rounded hover:bg-slate-800 transition-all"
                  title="Rename Video"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <StatusBadge stage={job.stage} status={job.status} size="sm" />
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-mono text-slate-500">ID: {job.id.slice(0, 8)}</span>
              <span>•</span>
              <span>Created {formatDate(job.created_at)}</span>
              <span>•</span>
              <span>Auto-Approve: {job.auto_approve ? "Enabled" : "Disabled (Checkpoints ON)"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
            {getOrientationIcon(job.target_orientation)}
            <span>
              {job.target_orientation === "vertical"
                ? "9:16 Portrait"
                : job.target_orientation === "square"
                ? "1:1 Square"
                : "16:9 Landscape"}
            </span>
          </div>

          <div className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono ${
            job.tts_provider === "custom"
              ? "bg-purple-950/40 border-purple-800/60 text-purple-300"
              : "bg-slate-900 border-slate-800 text-slate-400"
          }`}>
            {job.tts_provider === "custom" ? "Audio: Custom Upload" : `TTS: ${job.tts_provider}`}
          </div>

          {isDone && (
            <Link
              href={`/jobs/${job.id}/editor`}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-500 shadow-md shadow-blue-500/25 active:scale-95 transition-all"
            >
              <Film className="w-4 h-4" />
              <span>Open Editor</span>
            </Link>
          )}
        </div>
      </div>

      {/* 7-Stage Progress Stepper */}
      <div className="flex flex-col gap-3 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Pipeline Progression
          </span>
          <span className="text-xs font-mono text-slate-400">
            {isDone
              ? "All 7 Stages Complete"
              : `Stage ${Math.min(currentStepNumber, 7)} of 7`}
          </span>
        </div>

        {/* Stepper track */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2">
          {STAGE_CONFIGS.map((stage) => {
            const isCompleted = isDone || stage.stepNumber < currentStepNumber;
            const isCurrent = !isDone && stage.stepNumber === currentStepNumber;

            return (
              <div
                key={stage.key}
                className={`flex flex-col p-3 rounded-xl border transition-all ${
                  isCompleted
                    ? "bg-emerald-950/20 border-emerald-800/50 text-emerald-300"
                    : isCurrent
                    ? isFailed
                      ? "bg-rose-950/30 border-rose-800 text-rose-200 shadow-sm"
                      : isAwaitingApproval
                      ? "bg-amber-950/30 border-amber-800 text-amber-200 shadow-md shadow-amber-900/20 animate-pulse"
                      : "bg-blue-950/30 border-blue-700 text-blue-200 shadow-md shadow-blue-900/20"
                    : "bg-slate-950/40 border-slate-800/80 text-slate-500"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[10px] font-bold">
                    0{stage.stepNumber}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isCurrent ? (
                    isFailed ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    ) : isAwaitingApproval ? (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                    )
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-slate-800" />
                  )}
                </div>
                <span className="text-xs font-semibold truncate">
                  {stage.label}
                </span>
                <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                  {stage.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-time Stage Progress & Beat Counter */}
      {job.status === "in_progress" && (
        <div className="flex flex-col gap-3 p-5 rounded-2xl bg-blue-950/20 border border-blue-800/50 shadow-lg shadow-blue-950/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
              </span>
              <span className="text-xs font-semibold text-blue-200">
                {job.progress?.message || `Executing stage: ${job.stage}...`}
              </span>
            </div>
            {job.progress?.total && job.progress.total > 0 ? (
              <span className="text-xs font-mono font-bold text-blue-400">
                {job.progress.current} / {job.progress.total} ({job.progress.percent}%)
              </span>
            ) : null}
          </div>

          <div className="w-full bg-slate-950/80 h-2.5 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
            <div
              className="bg-gradient-to-r from-blue-600 to-cyan-400 h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${
                  job.progress?.percent !== undefined
                    ? Math.max(5, Math.min(100, job.progress.percent))
                    : 15
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Checkpoint 1: Script Review (if paused at structuring) */}
      {job.stage === "structuring" && isAwaitingApproval && (
        <ScriptReview job={job} onApproved={() => mutate()} />
      )}

      {/* Checkpoint 2: Footage Review (if paused at resolving_footage) */}
      {job.stage === "resolving_footage" && isAwaitingApproval && (
        <FootageReview job={job} onApproved={() => mutate()} />
      )}

      {/* Completed Video Banner */}
      {isDone && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-6 rounded-2xl bg-emerald-950/30 border border-emerald-800/60 shadow-xl shadow-emerald-950/20">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-emerald-900/40 border border-emerald-700/60 text-emerald-300">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-emerald-100">
                Video Timeline Compiled & Ready!
              </h2>
              <p className="text-xs text-emerald-300/80 mt-1 max-w-xl">
                The script has been synthesized, aligned, duration-matched with footage, and compiled into a multi-track Remotion timeline.
              </p>
              <div className="flex items-center gap-3 text-xs text-emerald-400 font-mono mt-3">
                <span>Duration: {job.timeline?.total_duration?.toFixed(1) || 0}s</span>
                <span>•</span>
                <span>Beats: {job.beats?.length || 0}</span>
                <span>•</span>
                <span>Tracks: {job.timeline?.tracks?.length || 3}</span>
              </div>
            </div>
          </div>

          <Link
            href={`/jobs/${job.id}/editor`}
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 active:scale-95 transition-all whitespace-nowrap"
          >
            <Film className="w-4 h-4" />
            <span>Open in Video Editor</span>
          </Link>
        </div>
      )}

      {/* Failed State Card with Retry */}
      {isFailed && (
        <div className="flex flex-col gap-4 p-6 rounded-2xl bg-rose-950/30 border border-rose-800/60">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-rose-200">
                  Pipeline Execution Error at Stage &apos;{job.stage}&apos;
                </h3>
                <p className="text-xs text-rose-300 mt-1 font-mono bg-rose-950/60 p-2.5 rounded-lg border border-rose-900/60">
                  {job.error_message || "An unexpected error occurred during pipeline execution."}
                </p>
              </div>
            </div>

            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-md shadow-rose-600/20 active:scale-95 transition-all"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`} />
              <span>Retry Stage</span>
            </button>
          </div>
        </div>
      )}

      {/* Intermediate Outputs & Diagnostics Accordion */}
      <div className="rounded-2xl bg-slate-900/40 border border-slate-800/80 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="flex items-center justify-between w-full p-4 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Code className="w-3.5 h-3.5 text-blue-400" />
            <span>Intermediate Pipeline Outputs & Diagnostics</span>
          </span>
          {showDiagnostics ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {showDiagnostics && (
          <div className="p-4 border-t border-slate-800 flex flex-col gap-4 font-mono text-xs">
            {/* Raw Input */}
            <div>
              <span className="text-slate-400 font-bold block mb-1">
                Raw Input:
              </span>
              <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {job.raw_input}
              </pre>
            </div>

            {/* Clean Script */}
            {job.clean_script && (
              <div>
                <span className="text-slate-400 font-bold block mb-1">
                  Clean Script (Stage 1):
                </span>
                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {job.clean_script}
                </pre>
              </div>
            )}

            {/* Structured Beats */}
            {job.beats && (
              <div>
                <span className="text-slate-400 font-bold block mb-1">
                  Beats (Stage 2):
                </span>
                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {JSON.stringify(job.beats, null, 2)}
                </pre>
              </div>
            )}

            {/* Timings */}
            {job.timings && (
              <div>
                <span className="text-slate-400 font-bold block mb-1">
                  Timings (Stage 4):
                </span>
                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {JSON.stringify(job.timings, null, 2)}
                </pre>
              </div>
            )}

            {/* Compiled Timeline */}
            {job.timeline && (
              <div>
                <span className="text-slate-400 font-bold block mb-1">
                  Compiled Timeline JSON (Stage 7):
                </span>
                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {JSON.stringify(job.timeline, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
