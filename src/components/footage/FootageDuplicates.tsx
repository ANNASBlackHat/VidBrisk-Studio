"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Archive,
  Layers,
  ArrowRight,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  Play,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Ban,
} from "lucide-react";
import { api } from "@/lib/api";
import { DuplicateGroup, DuplicateMember } from "@/lib/types";

export function FootageDuplicates() {
  const [activeTier, setActiveTier] = useState<"exact" | "near" | "similar">("exact");
  const [activeStatus, setActiveStatus] = useState<string>("pending");
  const [isScanning, setIsScanning] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const {
    data: duplicatesData,
    isLoading,
    mutate,
  } = useSWR(
    ["footage-duplicates", activeTier, activeStatus],
    () => api.getFootageDuplicates(activeTier, activeStatus),
    { revalidateOnFocus: false }
  );

  const handleTriggerScan = async () => {
    try {
      setIsScanning(true);
      await api.triggerDetectDuplicates(15);
      await mutate();
    } catch (err) {
      console.error("Duplicate scan failed:", err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleResolve = async (groupId: string, action: "merge" | "keep" | "archive", keeperId?: string) => {
    try {
      setResolvingId(groupId);
      await api.resolveFootageDuplicate(groupId, {
        action,
        keeper_id: keeperId,
      });
      await mutate();
    } catch (err) {
      console.error("Resolve failed:", err);
    } finally {
      setResolvingId(null);
    }
  };

  const groups = duplicatesData?.groups || [];

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-2">
          {/* Tier Sub-tabs */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTier("exact")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTier === "exact"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Exact (100%)
            </button>
            <button
              onClick={() => setActiveTier("near")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTier === "near"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Near Duplicates (90-99%)
            </button>
            <button
              onClick={() => setActiveTier("similar")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTier === "similar"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Visually Similar (80-89%)
            </button>
          </div>

          {/* Status filter */}
          <select
            value={activeStatus}
            onChange={(e) => setActiveStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-xs text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="pending">Pending Triage</option>
            <option value="merged">Merged</option>
            <option value="kept">Kept (Distinct)</option>
            <option value="archived">Archived</option>
            <option value="all">All Statuses</option>
          </select>
        </div>

        {/* Scan Button */}
        <button
          onClick={handleTriggerScan}
          disabled={isScanning}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin text-indigo-400" : ""}`} />
          {isScanning ? "Scanning Library..." : "Run Duplicate Scan"}
        </button>
      </div>

      {/* Duplicate Groups List */}
      {isLoading ? (
        <div className="space-y-4 py-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-56 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/30 border border-dashed border-slate-800 rounded-xl">
          <ShieldCheck className="w-10 h-10 text-emerald-500/80 mx-auto mb-3" />
          <p className="text-slate-200 font-semibold text-sm">No {activeTier} duplicate clusters pending</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Click "Run Duplicate Scan" above to scan for identical file references and near-duplicate frames.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="text-xs text-slate-400">
            Found <strong className="text-slate-200">{groups.length}</strong> duplicate groups under{" "}
            <span className="capitalize">{activeTier}</span> tier
          </div>

          {groups.map((group) => (
            <DuplicateGroupCard
              key={group.id}
              group={group}
              isResolving={resolvingId === group.id}
              onResolve={(action, keeperId) => handleResolve(group.id, action, keeperId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DuplicateGroupCard({
  group,
  isResolving,
  onResolve,
}: {
  group: DuplicateGroup;
  isResolving: boolean;
  onResolve: (action: "merge" | "keep" | "archive", keeperId?: string) => void;
}) {
  const suggestedKeeperId = group.suggested_keeper_id || group.members[0]?.chunk_id;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
      {/* Group Card Header */}
      <div className="px-5 py-3.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Copy className="w-3.5 h-3.5 text-indigo-400" />
            Duplicate Group
          </span>
          <span className="font-mono text-slate-500">{group.id.slice(0, 8)}...</span>
          <span className="capitalize px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold">
            {group.tier}
          </span>
          <span className="text-[10px] text-slate-500">
            {group.members.length} copies detected
          </span>
        </div>

        {/* Status Badge */}
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
            group.status === "pending"
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              : group.status === "merged"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-slate-800 text-slate-400"
          }`}
        >
          {group.status}
        </span>
      </div>

      {/* Side-by-side Members Display */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        {group.members.map((member) => {
          const isSuggestedKeeper = member.chunk_id === suggestedKeeperId;
          const shot = member.shot;

          return (
            <div
              key={member.id}
              className={`relative bg-slate-950 border rounded-xl overflow-hidden p-3.5 flex flex-col justify-between transition-all ${
                isSuggestedKeeper
                  ? "border-emerald-500/50 shadow-sm shadow-emerald-500/10"
                  : "border-slate-800"
              }`}
            >
              {/* Keeper Badge */}
              {isSuggestedKeeper && (
                <div className="absolute top-2 right-2 z-10 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Suggested Keeper
                </div>
              )}

              {/* Video Preview */}
              <div className="relative aspect-video w-full bg-black rounded-lg overflow-hidden mb-3">
                {shot.storage_url ? (
                  <video
                    src={shot.storage_url}
                    controls
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : shot.thumbnail_url ? (
                  <img
                    src={shot.thumbnail_url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                    No preview
                  </div>
                )}
              </div>

              {/* Clip Metadata */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 capitalize flex items-center gap-1.5">
                    {shot.provider}
                    <span className="text-slate-500 text-[10px] font-mono">
                      ({shot.id.slice(0, 8)}...)
                    </span>
                  </span>
                  <span className="font-mono text-indigo-400 font-semibold">
                    {(member.similarity * 100).toFixed(0)}% Match
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/80">
                  <div>
                    <span className="text-slate-500 block">Resolution</span>
                    <strong className="text-slate-300 font-mono">
                      {shot.resolution || "Unknown"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Duration</span>
                    <strong className="text-slate-300">
                      {shot.duration_sec.toFixed(1)}s
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Motion Mean</span>
                    <span className="text-slate-300">
                      {shot.motion_mean !== null && shot.motion_mean !== undefined
                        ? shot.motion_mean.toFixed(1)
                        : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Usage Count</span>
                    <span className="text-slate-300">Used {shot.usage_count}x</span>
                  </div>
                </div>

                {shot.source_url && (
                  <div className="pt-1 truncate">
                    <a
                      href={shot.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-slate-500 hover:text-indigo-400 truncate flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{shot.source_url}</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Group Action Buttons */}
      {group.status === "pending" && (
        <div className="px-5 py-3.5 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-400">
            Suggested action: Keep <strong className="text-emerald-400">highest resolution copy</strong> and merge references.
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onResolve("archive")}
              disabled={isResolving}
              className="px-3 py-1.5 rounded-lg border border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Archive Group
            </button>
            <button
              onClick={() => onResolve("keep")}
              disabled={isResolving}
              className="px-3 py-1.5 rounded-lg border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Keep Both (Distinct)
            </button>
            <button
              onClick={() => onResolve("merge", suggestedKeeperId)}
              disabled={isResolving}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Merge & Archive Duplicates
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
