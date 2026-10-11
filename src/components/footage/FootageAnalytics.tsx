"use client";

import useSWR from "swr";
import {
  Film,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  TrendingUp,
  PieChart,
  Activity,
  Layers,
  Sparkles,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { FootageAnalyticsSummary } from "@/lib/types";

export function FootageAnalytics() {
  const { data: analytics, isLoading, error } = useSWR<FootageAnalyticsSummary>(
    "footage-analytics",
    () => api.getFootageAnalytics(),
    { revalidateOnFocus: false }
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-900 border border-slate-800 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 bg-slate-900 border border-slate-800 rounded-xl" />
          <div className="h-64 bg-slate-900 border border-slate-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="p-8 text-center bg-slate-900/50 border border-red-500/20 rounded-xl text-red-400">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-80" />
        <p className="font-semibold text-sm">Failed to load library analytics</p>
        <p className="text-xs text-slate-500 mt-1">Ensure backend API is running on localhost:8000</p>
      </div>
    );
  }

  // Calculate percentages for provider progress bars
  const totalProvShots = Object.values(analytics.providers_breakdown).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Total Indexed Shots</span>
            <p className="text-2xl font-bold text-white mt-1">{analytics.total_shots.toLocaleString()}</p>
            <span className="text-[11px] text-indigo-400 font-medium mt-1 inline-block">
              Across {analytics.total_assets.toLocaleString()} media assets
            </span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Film className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Library Footage Volume</span>
            <p className="text-2xl font-bold text-white mt-1">{analytics.total_duration_hours.toLocaleString()} hrs</p>
            <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">
              ~{(analytics.total_duration_hours * 60).toFixed(0)} minutes total duration
            </span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Unused Footage Share</span>
            <p className="text-2xl font-bold text-white mt-1">{analytics.unused_percentage}%</p>
            <span className="text-[11px] text-amber-400 font-medium mt-1 inline-block">
              {analytics.unused_shots_count.toLocaleString()} fresh available shots
            </span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">Orientation Mix</span>
            <p className="text-2xl font-bold text-white mt-1">
              {analytics.orientations_breakdown["horizontal"] || 0} Landscape
            </p>
            <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">
              {analytics.orientations_breakdown["vertical"] || 0} Portrait / Shorts
            </span>
          </div>
          <div className="w-11 h-11 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Grid of Analytical Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Provider Breakdown */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              Footage Shots by Provider
            </h3>
            <span className="text-xs text-slate-500">Distribution</span>
          </div>

          <div className="space-y-3 pt-1">
            {Object.entries(analytics.providers_breakdown).map(([prov, count]) => {
              const pct = ((count / totalProvShots) * 100).toFixed(1);
              return (
                <div key={prov} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="capitalize text-slate-300 font-medium">{prov}</span>
                    <span className="text-slate-400">
                      {count.toLocaleString()} shots ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        prov === "youtube"
                          ? "bg-red-500"
                          : prov === "pexels"
                          ? "bg-emerald-500"
                          : prov === "pixabay"
                          ? "bg-yellow-500"
                          : "bg-indigo-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Motion Dynamics Breakdown */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              Motion Score Dynamics
            </h3>
            <span className="text-xs text-slate-500">Frame Difference Mean</span>
          </div>

          <div className="space-y-3 pt-1">
            {analytics.motion_distribution.map((item) => {
              const totalM = analytics.motion_distribution.reduce((acc, curr) => acc + curr.count, 0) || 1;
              const pct = ((item.count / totalM) * 100).toFixed(1);
              return (
                <div key={item.tier} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">{item.tier}</span>
                    <span className="text-slate-400">
                      {item.count.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        item.tier.includes("Static")
                          ? "bg-amber-500"
                          : item.tier.includes("Low")
                          ? "bg-slate-500"
                          : item.tier.includes("High")
                          ? "bg-emerald-400"
                          : "bg-indigo-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Shot Duration Histogram */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              Shot Duration Distribution
            </h3>
            <span className="text-xs text-slate-500">Length Buckets</span>
          </div>

          <div className="grid grid-cols-4 gap-3 pt-2">
            {analytics.duration_histogram.map((bucket) => (
              <div
                key={bucket.bucket}
                className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-lg text-center"
              >
                <span className="text-[11px] text-slate-400 font-mono block">{bucket.bucket}</span>
                <p className="text-base font-bold text-white mt-1">{bucket.count.toLocaleString()}</p>
                <span className="text-[10px] text-indigo-400 font-medium">shots</span>
              </div>
            ))}
          </div>
        </div>

        {/* Resolution Breakdown */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Top Resolutions
            </h3>
            <span className="text-xs text-slate-500">Quality Breakdown</span>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {Object.entries(analytics.resolutions_breakdown).slice(0, 8).map(([res, count]) => (
              <div
                key={res}
                className="flex items-center gap-2 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs"
              >
                <span className="font-mono text-slate-200">{res}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                  {count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
