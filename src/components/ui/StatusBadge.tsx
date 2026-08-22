import React from "react";
import { JobStage, JobStatus, STAGE_CONFIGS } from "@/lib/types";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  XCircle,
} from "lucide-react";

interface StatusBadgeProps {
  stage: JobStage;
  status: JobStatus;
  size?: "sm" | "md" | "lg";
}

export function StatusBadge({
  stage,
  status,
  size = "md",
}: StatusBadgeProps) {
  const stageConfig = STAGE_CONFIGS.find((s) => s.key === stage);

  if (stage === "done" || status === "complete") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 ${
          size === "sm"
            ? "px-2 py-0.5 text-xs"
            : size === "lg"
            ? "px-3.5 py-1.5 text-sm"
            : "px-2.5 py-1 text-xs"
        }`}
      >
        <CheckCircle2 className={size === "lg" ? "w-4 h-4 text-emerald-400" : "w-3.5 h-3.5 text-emerald-400"} />
        <span>Completed</span>
      </div>
    );
  }

  if (stage === "failed" || status === "failed") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-rose-950/80 text-rose-300 border border-rose-800/60 ${
          size === "sm"
            ? "px-2 py-0.5 text-xs"
            : size === "lg"
            ? "px-3.5 py-1.5 text-sm"
            : "px-2.5 py-1 text-xs"
        }`}
      >
        <XCircle className={size === "lg" ? "w-4 h-4 text-rose-400" : "w-3.5 h-3.5 text-rose-400"} />
        <span>Failed</span>
      </div>
    );
  }

  if (status === "awaiting_approval") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-amber-950/80 text-amber-300 border border-amber-800/60 animate-pulse ${
          size === "sm"
            ? "px-2 py-0.5 text-xs"
            : size === "lg"
            ? "px-3.5 py-1.5 text-sm"
            : "px-2.5 py-1 text-xs"
        }`}
      >
        <AlertCircle className={size === "lg" ? "w-4 h-4 text-amber-400" : "w-3.5 h-3.5 text-amber-400"} />
        <span>Awaiting Approval ({stageConfig?.label || stage})</span>
      </div>
    );
  }

  if (status === "in_progress") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-blue-950/80 text-blue-300 border border-blue-800/60 ${
          size === "sm"
            ? "px-2 py-0.5 text-xs"
            : size === "lg"
            ? "px-3.5 py-1.5 text-sm"
            : "px-2.5 py-1 text-xs"
        }`}
      >
        <Loader2 className={`animate-spin ${size === "lg" ? "w-4 h-4 text-blue-400" : "w-3.5 h-3.5 text-blue-400"}`} />
        <span>
          {stageConfig ? `Stage ${stageConfig.stepNumber}/7: ${stageConfig.label}` : stage}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full font-medium bg-slate-900 text-slate-300 border border-slate-800 ${
        size === "sm"
          ? "px-2 py-0.5 text-xs"
          : size === "lg"
          ? "px-3.5 py-1.5 text-sm"
          : "px-2.5 py-1 text-xs"
      }`}
    >
      <Clock className={size === "lg" ? "w-4 h-4 text-slate-400" : "w-3.5 h-3.5 text-slate-400"} />
      <span>Pending</span>
    </div>
  );
}
