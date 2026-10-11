"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Search,
  Filter,
  SlidersHorizontal,
  Play,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Tag,
  Clock,
  Layers,
  Activity,
  Eye,
  CheckCircle2,
  XCircle,
  Copy,
  ChevronDown,
  ChevronRight,
  Maximize2,
  X,
  Smartphone,
  Monitor,
  Square,
  AlertCircle,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { Shot, ShotFilterParams } from "@/lib/types";

export function FootageExplore() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState("xclip-base-patch32");
  const [provider, setProvider] = useState("all");
  const [orientation, setOrientation] = useState("all");
  const [minMotion, setMinMotion] = useState<number | undefined>(undefined);
  const [usedFilter, setUsedFilter] = useState<"all" | "used" | "unused">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "duration_desc" | "motion_desc" | "usage_desc">("newest");
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeSearch, setActiveSearch] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Shot[] | null>(null);
  const [searchLatency, setSearchLatency] = useState<number | null>(null);

  // Fetch browsing shots with filters
  const filterParams: ShotFilterParams = {
    provider: provider !== "all" ? provider : undefined,
    orientation: orientation !== "all" ? orientation : undefined,
    min_motion: minMotion,
    used: usedFilter,
    sort: sortBy,
    limit: 48,
  };

  const {
    data: browseData,
    isLoading: isBrowseLoading,
    mutate,
  } = useSWR(
    activeSearch ? null : ["footage-shots", filterParams],
    () => api.getFootageShots(filterParams),
    { revalidateOnFocus: false }
  );

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setActiveSearch(null);
      setSearchResults(null);
      return;
    }

    try {
      setIsSearching(true);
      setActiveSearch(searchQuery.trim());
      const res = await api.searchFootage({
        query: searchQuery.trim(),
        model_id: selectedModel,
        provider: provider !== "all" ? provider : undefined,
        orientation: orientation !== "all" ? (orientation as any) : undefined,
        min_motion: minMotion,
        used_filter: usedFilter,
        limit: 40,
      });
      setSearchResults(res.results);
      setSearchLatency(res.latency_ms);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setActiveSearch(null);
    setSearchResults(null);
    setSearchLatency(null);
  };

  const displayShots = activeSearch ? searchResults || [] : browseData?.items || [];
  const totalCount = activeSearch ? searchResults?.length || 0 : browseData?.total || 0;

  return (
    <div className="space-y-5">
      {/* Search Header Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm backdrop-blur">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search meaning across footage (e.g. 'underwater shipwreck', 'diver swimming inside reef', 'stormy dark sea')..."
              className="w-full pl-10 pr-24 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            />
            {activeSearch && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            {/* Model Selector */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg text-xs text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="xclip-base-patch32" className="bg-slate-900">
                  X-CLIP (512d)
                </option>
                <option value="Qwen/Qwen3-VL-Embedding-2B" className="bg-slate-900">
                  Qwen3-VL (2048d)
                </option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50"
            >
              {isSearching ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search
            </button>
          </div>
        </form>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Provider Filter */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800/80 px-2.5 py-1.5 rounded-md text-slate-300">
              <span className="text-slate-500">Source:</span>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All Sources</option>
                <option value="youtube" className="bg-slate-900">YouTube</option>
                <option value="pexels" className="bg-slate-900">Pexels</option>
                <option value="pixabay" className="bg-slate-900">Pixabay</option>
                <option value="wikimedia" className="bg-slate-900">Wikimedia</option>
              </select>
            </div>

            {/* Orientation Filter */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800/80 px-2.5 py-1.5 rounded-md text-slate-300">
              <span className="text-slate-500">Orientation:</span>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All</option>
                <option value="horizontal" className="bg-slate-900">Horizontal (16:9)</option>
                <option value="vertical" className="bg-slate-900">Vertical (9:16)</option>
                <option value="square" className="bg-slate-900">Square (1:1)</option>
              </select>
            </div>

            {/* Motion Filter */}
            <button
              onClick={() => setMinMotion(minMotion ? undefined : 4.0)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors ${
                minMotion
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                  : "bg-slate-950 border-slate-800/80 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Hide Static Clips (&lt;4.0)
            </button>

            {/* Usage Filter */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800/80 px-2.5 py-1.5 rounded-md text-slate-300">
              <span className="text-slate-500">Usage:</span>
              <select
                value={usedFilter}
                onChange={(e) => setUsedFilter(e.target.value as any)}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">All</option>
                <option value="unused" className="bg-slate-900">Never Used Only</option>
                <option value="used" className="bg-slate-900">Used In Videos</option>
              </select>
            </div>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-md text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="newest" className="bg-slate-900">Newest Added</option>
              <option value="oldest" className="bg-slate-900">Oldest</option>
              <option value="motion_desc" className="bg-slate-900">Highest Motion</option>
              <option value="duration_desc" className="bg-slate-900">Longest Duration</option>
              <option value="usage_desc" className="bg-slate-900">Most Used</option>
            </select>
          </div>
        </div>
      </div>

      {/* Result Status Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <div>
          {activeSearch ? (
            <span>
              Showing ranked matches for <strong className="text-slate-200">"{activeSearch}"</strong> ({displayShots.length} results
              {searchLatency !== null ? ` in ${searchLatency}ms` : ""})
            </span>
          ) : (
            <span>
              Displaying <strong className="text-slate-200">{displayShots.length}</strong> of{" "}
              <strong className="text-slate-200">{totalCount.toLocaleString()}</strong> library shots
            </span>
          )}
        </div>
        {browseData && (
          <div className="text-slate-500">
            Page limit: {browseData.limit} shots
          </div>
        )}
      </div>

      {/* Shots Grid */}
      {isBrowseLoading || isSearching ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 py-8">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-44 bg-slate-900/60 border border-slate-800/60 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : displayShots.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/30 border border-dashed border-slate-800 rounded-xl">
          <FilmIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">No matching footage shots found</p>
          <p className="text-xs text-slate-500 mt-1">Try relaxing your filters or typing different keywords.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {displayShots.map((shot) => (
            <ShotCard
              key={shot.id}
              shot={shot}
              onSelect={() => setSelectedShot(shot)}
            />
          ))}
        </div>
      )}

      {/* Detail Drawer Modal */}
      {selectedShot && (
        <ShotDetailDrawer
          shot={selectedShot}
          onClose={() => setSelectedShot(null)}
        />
      )}
    </div>
  );
}

function ShotCard({ shot, onSelect }: { shot: Shot; onSelect: () => void }) {
  const [isHovered, setIsHovered] = useState(false);

  const durationStr = `${shot.duration_sec.toFixed(1)}s`;
  const motionScore = shot.motion_score !== undefined && shot.motion_score !== null ? shot.motion_score.toFixed(1) : null;

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex flex-col bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/10"
    >
      {/* Thumbnail / Video Container */}
      <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
        {isHovered && shot.storage_url ? (
          <video
            src={shot.storage_url}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : shot.thumbnail_url ? (
          <img
            src={shot.thumbnail_url}
            alt={shot.caption || "Footage thumbnail"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-600">
            <Play className="w-6 h-6 mb-1 opacity-50" />
            <span className="text-[10px]">No Preview</span>
          </div>
        )}

        {/* Duration badge */}
        <span className="absolute bottom-1.5 right-1.5 bg-black/80 backdrop-blur-sm text-[10px] font-mono text-slate-200 px-1.5 py-0.5 rounded">
          {durationStr}
        </span>

        {/* Orientation badge */}
        <span className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-sm text-slate-300 p-1 rounded">
          {shot.orientation === "vertical" ? (
            <Smartphone className="w-3 h-3 text-emerald-400" />
          ) : shot.orientation === "square" ? (
            <Square className="w-3 h-3 text-sky-400" />
          ) : (
            <Monitor className="w-3 h-3 text-blue-400" />
          )}
        </span>

        {/* Similarity Score if in search */}
        {shot.similarity_score !== undefined && (
          <span className="absolute top-1.5 right-1.5 bg-indigo-600/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
            {(shot.similarity_score * 100).toFixed(0)}%
          </span>
        )}

        {/* Loop flag */}
        {shot.is_loop && (
          <span className="absolute bottom-1.5 left-1.5 bg-amber-500/90 text-slate-950 text-[9px] font-bold px-1 rounded flex items-center gap-0.5">
            <RotateCcw className="w-2.5 h-2.5" /> Loop
          </span>
        )}
      </div>

      {/* Card Info */}
      <div className="p-2.5 flex-1 flex flex-col justify-between text-xs">
        <div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
            <span className="capitalize font-medium text-slate-300 px-1.5 py-0.5 rounded bg-slate-800/80">
              {shot.provider}
            </span>
            {motionScore && (
              <span className="flex items-center gap-0.5 text-slate-400" title="Motion Energy Score">
                <Activity className="w-3 h-3 text-indigo-400" />
                {motionScore}
              </span>
            )}
          </div>
          <p className="text-[11px] font-medium text-slate-200 line-clamp-1 group-hover:text-indigo-300 transition-colors">
            {shot.item_metadata?.title ? String(shot.item_metadata.title) : (shot.caption || `Shot ${shot.id.slice(0, 8)}`)}
          </p>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 pt-1.5 border-t border-slate-800/60">
          <span>{shot.resolution || "Unknown res"}</span>
          <span>Used {shot.usage_count}x</span>
        </div>
      </div>
    </div>
  );
}

function ShotDetailDrawer({ shot, onClose }: { shot: Shot; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(shot.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl h-full bg-slate-950 border-l border-slate-800 p-6 flex flex-col justify-between overflow-y-auto">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Shot Detail
                <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                  {shot.id.slice(0, 8)}...
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Asset ID: {shot.asset_id.slice(0, 8)}...</p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Video Player */}
          <div className="rounded-xl overflow-hidden bg-black border border-slate-800 aspect-video flex items-center justify-center">
            {shot.storage_url ? (
              <video
                src={shot.storage_url}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            ) : shot.thumbnail_url ? (
              <img
                src={shot.thumbnail_url}
                alt="Thumbnail"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center text-slate-500 text-xs">
                No playable media available
              </div>
            )}
          </div>

          {/* Properties Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-lg">
              <span className="text-slate-500">Provider</span>
              <p className="font-semibold text-slate-200 capitalize mt-0.5">{shot.provider}</p>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-lg">
              <span className="text-slate-500">Duration</span>
              <p className="font-semibold text-slate-200 mt-0.5">{shot.duration_sec.toFixed(2)} seconds</p>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-lg">
              <span className="text-slate-500">Resolution & Orientation</span>
              <p className="font-semibold text-slate-200 mt-0.5">{shot.resolution || "Unknown"} ({shot.orientation})</p>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-lg">
              <span className="text-slate-500">Motion Mean (Energy)</span>
              <p className="font-semibold text-slate-200 mt-0.5">
                {shot.motion_mean !== null && shot.motion_mean !== undefined ? shot.motion_mean.toFixed(2) : "N/A"}{" "}
                {shot.is_loop && <span className="text-amber-400 font-normal">(Loop detected)</span>}
              </p>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-lg">
              <span className="text-slate-500">Timestamps in Video</span>
              <p className="font-semibold text-slate-200 mt-0.5">
                {shot.start_ts.toFixed(1)}s - {shot.end_ts !== null && shot.end_ts !== undefined ? `${shot.end_ts.toFixed(1)}s` : "End"}
              </p>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-lg">
              <span className="text-slate-500">Usage History</span>
              <p className="font-semibold text-slate-200 mt-0.5">Used in {shot.usage_count} videos</p>
            </div>
          </div>

          {/* Source Link */}
          {shot.source_url && (
            <div className="p-3 bg-slate-900/50 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
              <div className="truncate mr-2">
                <span className="text-slate-500 block">Original Source URL</span>
                <span className="text-indigo-400 truncate block">{shot.source_url}</span>
              </div>
              <a
                href={shot.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          )}

          {/* Metadata Description */}
          {shot.item_metadata && (
            <div className="text-xs space-y-1">
              <span className="text-slate-500">Asset Title & Details</span>
              <p className="text-slate-300 bg-slate-900/40 p-3 rounded-lg border border-slate-800/60 leading-relaxed">
                {shot.item_metadata.title ? String(shot.item_metadata.title) : (shot.caption || "No description provided")}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
          <button
            onClick={handleCopyId}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? "Copied ID!" : "Copy Shot ID"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function FilmIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" strokeWidth="2" />
      <path strokeWidth="2" d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4M3 12h18" />
    </svg>
  );
}
