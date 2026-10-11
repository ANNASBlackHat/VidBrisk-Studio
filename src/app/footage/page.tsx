"use client";

import { useState } from "react";
import {
  Compass,
  BarChart3,
  Copy,
  Layers,
  Sparkles,
  Network,
  Bug,
  Scale,
  Inbox,
} from "lucide-react";
import { FootageExplore } from "@/components/footage/FootageExplore";
import { FootageAnalytics } from "@/components/footage/FootageAnalytics";
import { FootageDuplicates } from "@/components/footage/FootageDuplicates";
import { FootageMap } from "@/components/footage/FootageMap";
import { FootageDebugger } from "@/components/footage/FootageDebugger";
import { FootageEvalHarness } from "@/components/footage/FootageEvalHarness";
import { FootageCuration } from "@/components/footage/FootageCuration";

export default function FootagePage() {
  const [activeTab, setActiveTab] = useState<
    "explore" | "analytics" | "duplicates" | "map" | "debugger" | "eval" | "curation"
  >("explore");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              Footage Library & Analytics
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              VidBrisk Engine
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Search 20,000+ indexed shots with semantic embeddings, analyze motion dynamics, inspect selection debuggers, and triage curation queues.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center flex-wrap bg-slate-900 border border-slate-800 rounded-lg p-1 self-start md:self-auto gap-0.5">
          <button
            onClick={() => setActiveTab("explore")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "explore"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Explore
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "analytics"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Analytics
          </button>
          <button
            onClick={() => setActiveTab("duplicates")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "duplicates"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Copy className="w-3.5 h-3.5" />
            Duplicates
          </button>
          <button
            onClick={() => setActiveTab("map")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "map"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            Map
          </button>
          <button
            onClick={() => setActiveTab("debugger")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "debugger"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Bug className="w-3.5 h-3.5" />
            Selection Debugger
          </button>
          <button
            onClick={() => setActiveTab("eval")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "eval"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            Eval Harness
          </button>
          <button
            onClick={() => setActiveTab("curation")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "curation"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            Curation
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === "explore" && <FootageExplore />}
      {activeTab === "analytics" && <FootageAnalytics />}
      {activeTab === "duplicates" && <FootageDuplicates />}
      {activeTab === "map" && <FootageMap />}
      {activeTab === "debugger" && <FootageDebugger />}
      {activeTab === "eval" && <FootageEvalHarness />}
      {activeTab === "curation" && <FootageCuration />}
    </div>
  );
}

