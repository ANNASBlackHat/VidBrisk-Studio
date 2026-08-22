"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Film,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Monitor,
  Smartphone,
  Square,
  Sparkles,
  RotateCcw,
  Ban,
  Layers,
  Trash2,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { JobSummaryResponse, TargetOrientation } from "@/lib/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils";
import { MotionGallery } from "@/components/motion/MotionGallery";

export default function DashboardPage() {
  const [filter, setFilter] = useState<string>("all");
  const [isRetrying, setIsRetrying] = useState<string | null>(null);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [isSavingTitle, setIsSavingTitle] = useState<boolean>(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);

  const {
    data: jobs,
    isLoading,
    mutate,
  } = useSWR<JobSummaryResponse[]>("jobs-list", () => api.getJobs({ limit: 50 }), {
    refreshInterval: 3000,
    revalidateOnFocus: true,
  });

  const allJobs = jobs || [];

  const counts = {
    all: allJobs.length,
    in_progress: allJobs.filter(
      (j) => j.status === "in_progress" || j.status === "pending"
    ).length,
    awaiting_approval: allJobs.filter((j) => j.status === "awaiting_approval").length,
    done: allJobs.filter((j) => j.stage === "done" || j.status === "complete").length,
    failed: allJobs.filter((j) => j.stage === "failed" || j.status === "failed").length,
  };

  const filteredJobs = allJobs.filter((job) => {
    if (filter === "in_progress") {
      return job.status === "in_progress" || job.status === "pending";
    }
    if (filter === "awaiting_approval") {
      return job.status === "awaiting_approval";
    }
    if (filter === "done") {
      return job.stage === "done" || job.status === "complete";
    }
    if (filter === "failed") {
      return job.stage === "failed" || job.status === "failed";
    }
    return true;
  });

  const getOrientationIcon = (orientation: TargetOrientation) => {
    switch (orientation) {
      case "vertical":
        return <Smartphone className="w-3.5 h-3.5" />;
      case "square":
        return <Square className="w-3.5 h-3.5" />;
      default:
        return <Monitor className="w-3.5 h-3.5" />;
    }
  };

  const handleRetry = async (jobId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setIsRetrying(jobId);
      await api.retryJob(jobId);
      await mutate();
    } catch (err) {
      console.error("Failed to retry job", err);
    } finally {
      setIsRetrying(null);
    }
  };

  const handleCancel = async (jobId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to cancel this job?")) return;
    try {
      await api.cancelJob(jobId);
      await mutate();
    } catch (err) {
      console.error("Failed to cancel job", err);
    }
  };

  const handleStartEdit = (job: JobSummaryResponse, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingJobId(job.id);
    setEditTitle(job.title || `Video ${job.id.slice(0, 8)}`);
  };

  const handleSaveTitle = async (jobId: string, e?: React.MouseEvent | React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!editTitle.trim()) return;

    try {
      setIsSavingTitle(true);
      await api.updateJob(jobId, { title: editTitle.trim() });
      await mutate();
      setEditingJobId(null);
    } catch (err) {
      console.error("Failed to update video title", err);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleCancelEdit = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setEditingJobId(null);
    setEditTitle("");
  };

  const handleDelete = async (jobId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this video generation job and all its rendered outputs?")) {
      return;
    }

    try {
      setDeletingJobId(jobId);
      await api.deleteJob(jobId);
      await mutate();
    } catch (err) {
      console.error("Failed to delete job", err);
      alert("Failed to delete job: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDeletingJobId(null);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header & Primary CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Video Generation Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor autonomous generation pipelines, checkpoint approvals, and timeline editing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => mutate()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors"
            title="Refresh jobs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/jobs/new"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Video</span>
          </Link>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Jobs</span>
            <Layers className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-100 mt-2">{counts.all}</p>
        </div>

        <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/40 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-300">In Progress</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-blue-200 mt-2">{counts.in_progress}</p>
        </div>

        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-300">Awaiting Checkpoint</span>
            <AlertCircle className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <p className="text-2xl font-bold text-amber-200 mt-2">{counts.awaiting_approval}</p>
        </div>

        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-300">Completed Videos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-200 mt-2">{counts.done}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800">
        {[
          { id: "all", label: "All Jobs", count: counts.all },
          { id: "in_progress", label: "In Progress", count: counts.in_progress },
          { id: "awaiting_approval", label: "Awaiting Approval", count: counts.awaiting_approval },
          { id: "done", label: "Completed", count: counts.done },
          { id: "failed", label: "Failed", count: counts.failed },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              filter === tab.id
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                filter === tab.id
                  ? "bg-slate-700 text-slate-200"
                  : "bg-slate-900 text-slate-400"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Jobs Listing */}
      {filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-slate-900/30 border border-dashed border-slate-800">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-950/60 text-blue-400 border border-blue-800/40 mb-4">
            <Film className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-200">No jobs found</h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1 mb-6">
            {filter === "all"
              ? "You haven't generated any videos yet. Submit your first raw script to test the autonomous pipeline."
              : `No video generation jobs match the filter '${filter}'.`}
          </p>
          <Link
            href="/jobs/new"
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors shadow-md shadow-blue-500/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Generate New Video</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredJobs.map((job) => {
            const isDone = job.stage === "done" || job.status === "complete";
            const isAwaiting = job.status === "awaiting_approval";
            const isFailed = job.stage === "failed" || job.status === "failed";
            const targetUrl = isDone
              ? `/jobs/${job.id}/editor`
              : `/jobs/${job.id}`;

            return (
              <div
                key={job.id}
                className={`group relative flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-xl border transition-all ${
                  isAwaiting
                    ? "bg-amber-950/10 border-amber-800/50 hover:border-amber-700"
                    : isDone
                    ? "bg-slate-900/40 border-slate-800/80 hover:border-blue-500/40"
                    : isFailed
                    ? "bg-rose-950/10 border-rose-900/40"
                    : "bg-slate-900/30 border-slate-800/80 hover:border-slate-700"
                }`}
              >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className="flex flex-col items-center justify-center p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 shrink-0">
                    {getOrientationIcon(job.target_orientation)}
                    <span className="text-[9px] uppercase font-mono mt-1 text-slate-400">
                      {job.target_orientation === "vertical"
                        ? "9:16"
                        : job.target_orientation === "square"
                        ? "1:1"
                        : "16:9"}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    {/* Title and inline rename form */}
                    {editingJobId === job.id ? (
                      <div className="flex items-center gap-2 max-w-lg">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveTitle(job.id, e);
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          autoFocus
                          disabled={isSavingTitle}
                          className="px-2.5 py-1 text-sm bg-slate-950 border border-blue-500 rounded-md text-white focus:outline-none flex-1 font-medium"
                          placeholder="Enter video title..."
                        />
                        <button
                          type="button"
                          onClick={(e) => handleSaveTitle(job.id, e)}
                          disabled={isSavingTitle}
                          className="p-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                          title="Save Title"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={isSavingTitle}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group/title">
                        <Link
                          href={targetUrl}
                          className="font-semibold text-sm sm:text-base text-slate-100 hover:text-blue-400 transition-colors line-clamp-1 flex items-center gap-1.5"
                        >
                          <span>{job.title || `Video ${job.id.slice(0, 8)}`}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => handleStartEdit(job, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-slate-200 rounded hover:bg-slate-800 transition-all"
                          title="Rename video"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Metadata & Status */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Link
                        href={targetUrl}
                        className="font-mono text-[11px] text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-0.5"
                      >
                        <span>ID: {job.id.slice(0, 8)}</span>
                        <ChevronRight className="w-3 h-3 text-slate-500 group-hover:text-blue-400" />
                      </Link>

                      <StatusBadge stage={job.stage} status={job.status} size="sm" />

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/60 font-mono">
                          TTS: {job.tts_provider}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/60 font-mono">
                          Align: {job.aligner_provider}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                      Created {formatDate(job.created_at)} • Checkpoints:{" "}
                      {job.auto_approve ? "Disabled (Auto)" : "Enabled"}
                    </p>

                    {job.error_message && (
                      <p className="text-xs text-rose-400 mt-1 line-clamp-1 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/50">
                        Error: {job.error_message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800/80 shrink-0">
                  {isDone ? (
                    <Link
                      href={`/jobs/${job.id}/editor`}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-all shadow-sm shadow-blue-500/20"
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span>Open Editor</span>
                    </Link>
                  ) : isAwaiting ? (
                    <Link
                      href={`/jobs/${job.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-all shadow-sm shadow-amber-400/20 animate-pulse"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Review Checkpoint</span>
                    </Link>
                  ) : isFailed ? (
                    <button
                      onClick={(e) => handleRetry(job.id, e)}
                      disabled={isRetrying === job.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      <RotateCcw
                        className={`w-3.5 h-3.5 ${
                          isRetrying === job.id ? "animate-spin" : ""
                        }`}
                      />
                      <span>Retry</span>
                    </button>
                  ) : (
                    <Link
                      href={`/jobs/${job.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>View Progress</span>
                    </Link>
                  )}

                  {!isDone && !isFailed && (
                    <button
                      onClick={(e) => handleCancel(job.id, e)}
                      className="p-1.5 text-slate-500 hover:text-amber-400 rounded-lg hover:bg-slate-800/80 transition-colors"
                      title="Cancel Job"
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={(e) => handleDelete(job.id, e)}
                    disabled={deletingJobId === job.id}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-950/30 transition-colors"
                    title="Delete Video"
                  >
                    <Trash2 className={`w-3.5 h-3.5 ${deletingJobId === job.id ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Motion Component Registry Showcase */}
      <div className="mt-8">
        <MotionGallery />
      </div>
    </div>
  );
}
