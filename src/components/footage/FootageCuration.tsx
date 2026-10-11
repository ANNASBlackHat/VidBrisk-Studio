"use client";

import { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import {
  Check,
  X,
  Tag,
  Play,
  Pause,
  RotateCw,
  Clock,
  Activity,
  Layers,
  Sparkles,
  Keyboard,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import { CurationQueueItem, Shot } from "@/lib/types";

export function FootageCuration() {
  const [filterStatus, setFilterStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTagging, setIsTagging] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Video playback ref
  const [isPlaying, setIsPlaying] = useState(true);

  // Fetch curation queue
  const { data, isLoading, mutate } = useSWR(
    ["curation-queue", filterStatus],
    () => api.getCurationQueue(filterStatus, 50, 0),
    { revalidateOnFocus: false }
  );

  const items = data?.items || [];
  const currentItem: CurationQueueItem | undefined = items[currentIndex];
  const shot: Shot | undefined = currentItem?.shot;

  const handleAction = useCallback(
    async (status: "approved" | "rejected", tags?: string[]) => {
      if (!shot) return;
      try {
        await api.updateShotCuration(shot.id, status, tags);
        setActionNotice(
          status === "approved"
            ? `Approved shot #${shot.id.slice(0, 8)}`
            : `Rejected shot #${shot.id.slice(0, 8)}`
        );
        setTimeout(() => setActionNotice(null), 2500);

        // Advance to next or mutate
        if (currentIndex < items.length - 1) {
          setCurrentIndex((idx) => idx + 1);
        } else {
          await mutate();
          setCurrentIndex(0);
        }
      } catch (err: any) {
        alert(`Action failed: ${err.message || "Unknown error"}`);
      }
    },
    [shot, currentIndex, items.length, mutate]
  );

  // Keyboard Navigation Hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing tags in input
      if (isTagging) {
        if (e.key === "Escape") setIsTagging(false);
        return;
      }

      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        handleAction("approved");
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleAction("rejected");
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        setIsTagging(true);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (currentIndex < items.length - 1) setCurrentIndex((idx) => idx + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentIndex > 0) setCurrentIndex((idx) => idx - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleAction, currentIndex, items.length, isTagging]);

  const handleAddTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagInput.trim() || !shot) return;
    const newTags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    await handleAction("approved", newTags);
    setTagInput("");
    setIsTagging(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Status Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <span>Curation & Triage Queue</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-normal">
              {data?.total || 0} shots in queue
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Rapid review newly ingested footage using keyboard shortcuts: <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono text-[10px] text-white">[A]</kbd> Approve, <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono text-[10px] text-white">[R]</kbd> Reject, <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 font-mono text-[10px] text-white">[T]</kbd> Tag.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1">
          <button
            onClick={() => {
              setFilterStatus("pending");
              setCurrentIndex(0);
            }}
            className={`px-3 py-1 text-xs font-medium rounded transition-all ${
              filterStatus === "pending"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => {
              setFilterStatus("approved");
              setCurrentIndex(0);
            }}
            className={`px-3 py-1 text-xs font-medium rounded transition-all ${
              filterStatus === "approved"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => {
              setFilterStatus("rejected");
              setCurrentIndex(0);
            }}
            className={`px-3 py-1 text-xs font-medium rounded transition-all ${
              filterStatus === "rejected"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Rejected
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg bg-indigo-950/40 border border-indigo-800/40 text-indigo-300">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Main Review Card */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-20 gap-3 bg-slate-900/40 border border-slate-800 rounded-2xl">
          <RotateCw className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-xs text-slate-400">Loading curation candidates...</p>
        </div>
      ) : !shot ? (
        <div className="p-16 text-center bg-slate-900/30 border border-slate-800 rounded-2xl space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto opacity-70" />
          <h3 className="text-sm font-semibold text-white">Queue Empty!</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No footage clips waiting for triage under &quot;{filterStatus}&quot;.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          {/* Left: Video Player Area */}
          <div className="lg:col-span-8 flex flex-col space-y-4">
            <div className="relative aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
              {shot.storage_url ? (
                <video
                  src={shot.storage_url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  controls
                  className="w-full h-full object-contain"
                />
              ) : shot.thumbnail_url ? (
                <img
                  src={shot.thumbnail_url}
                  alt={shot.caption || "Shot thumbnail"}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-slate-600 flex flex-col items-center gap-1">
                  <Play className="w-8 h-8 opacity-40" />
                  <span className="text-xs">No media preview</span>
                </div>
              )}

              {/* Counter Pill */}
              <div className="absolute top-3 left-3 bg-black/75 backdrop-blur text-white text-xs font-mono px-2.5 py-1 rounded-md border border-white/10">
                {currentIndex + 1} of {items.length}
              </div>
            </div>

            {/* Quick Action Button Bar */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={() => handleAction("rejected")}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 font-semibold text-xs transition-all shadow-sm"
              >
                <X className="w-4 h-4" /> Reject <span className="font-mono text-[10px] opacity-70">[R]</span>
              </button>

              <button
                onClick={() => setIsTagging(true)}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-all shadow-sm"
              >
                <Tag className="w-4 h-4 text-indigo-400" /> Add Tags <span className="font-mono text-[10px] opacity-70">[T]</span>
              </button>

              <button
                onClick={() => handleAction("approved")}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md shadow-emerald-950/30"
              >
                <Check className="w-4 h-4" /> Approve <span className="font-mono text-[10px] opacity-70">[A]</span>
              </button>
            </div>

            {/* Tagging Drawer */}
            {isTagging && (
              <form
                onSubmit={handleAddTagSubmit}
                className="flex items-center gap-2 p-3 bg-slate-950 border border-indigo-500/50 rounded-xl"
              >
                <Tag className="w-4 h-4 text-indigo-400 shrink-0" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Enter comma-separated tags (e.g., naval, cargo_ship, aerial)..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-medium"
                >
                  Save & Approve
                </button>
                <button
                  type="button"
                  onClick={() => setIsTagging(false)}
                  className="px-2 py-1 text-slate-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>

          {/* Right: Metadata Panel */}
          <div className="lg:col-span-4 flex flex-col justify-between space-y-4 text-xs">
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Shot Caption & ID
                </span>
                <h3 className="text-sm font-semibold text-white mt-1">
                  {shot.caption || "Untitled Footage Shot"}
                </h3>
                <p className="text-[11px] font-mono text-slate-500 break-all mt-0.5">
                  ID: {shot.id}
                </p>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Provider</span>
                  <p className="text-slate-200 font-bold capitalize mt-0.5">{shot.provider}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Duration</span>
                  <p className="text-slate-200 font-bold mt-0.5">{shot.duration_sec.toFixed(1)}s</p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Resolution</span>
                  <p className="text-slate-200 font-bold mt-0.5">{shot.resolution || "1080p"}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Motion Dynamo</span>
                  <p className="text-slate-200 font-bold mt-0.5">
                    {shot.motion_score !== undefined
                      ? `${(shot.motion_score * 100).toFixed(0)}%`
                      : "N/A"}
                  </p>
                </div>
              </div>

              {/* Tags List */}
              {currentItem.tags && currentItem.tags.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1.5">
                    Assigned Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {currentItem.tags.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[11px]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Keyboard Guide Legend */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <span className="font-semibold text-slate-300 block mb-1">Keyboard Shortcuts:</span>
              <div className="flex items-center justify-between">
                <span>Approve:</span>
                <kbd className="font-mono text-slate-200 bg-slate-800 px-1 rounded">A</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Reject:</span>
                <kbd className="font-mono text-slate-200 bg-slate-800 px-1 rounded">R</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Add Tags:</span>
                <kbd className="font-mono text-slate-200 bg-slate-800 px-1 rounded">T</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Next / Prev:</span>
                <span className="font-mono text-slate-200">← / →</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
