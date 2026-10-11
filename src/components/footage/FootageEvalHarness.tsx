"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Scale,
  Play,
  RotateCw,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Clock,
  Layers,
  CheckCircle2,
  XCircle,
  Activity,
  Plus,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { EvalCompareResponse, EvalQueryItem } from "@/lib/types";

const DEFAULT_QUERIES = [
  "deep ocean submarine diving in abyss",
  "ancient sunken wooden shipwreck",
  "majestic giant blue whale underwater",
  "modern container ship navigating rough seas",
];

export function FootageEvalHarness() {
  const [modelA, setModelA] = useState<string>("xclip-base-patch32");
  const [modelB, setModelB] = useState<string>("Qwen/Qwen3-VL-Embedding-2B");
  const [queries, setQueries] = useState<string[]>(DEFAULT_QUERIES);
  const [newQueryInput, setNewQueryInput] = useState<string>("");
  const [topK, setTopK] = useState<number>(4);

  const [isRunning, setIsRunning] = useState(false);
  const [evalResult, setEvalResult] = useState<EvalCompareResponse | null>(null);

  // Models list
  const { data: modelsData } = useSWR(
    "footage-models",
    () => api.getFootageModels(),
    { revalidateOnFocus: false }
  );

  const handleAddQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueryInput.trim()) return;
    setQueries([...queries, newQueryInput.trim()]);
    setNewQueryInput("");
  };

  const handleRemoveQuery = (index: number) => {
    setQueries(queries.filter((_, i) => i !== index));
  };

  const handleRunComparison = async () => {
    if (queries.length === 0) return;
    setIsRunning(true);
    try {
      const res = await api.runEvalCompare({
        queries,
        model_a: modelA,
        model_b: modelB,
        top_k: topK,
      });
      setEvalResult(res);
    } catch (err: any) {
      alert(`Eval run failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Model Evaluation Harness</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Benchmark retrieval quality, Top-1 agreement, and search latency side-by-side between embedding models.
              </p>
            </div>
          </div>

          <button
            onClick={handleRunComparison}
            disabled={isRunning || queries.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all self-start sm:self-auto"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRunning ? "animate-spin" : ""}`} />
            Run Model Comparison
          </button>
        </div>

        {/* Model Selectors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800 text-xs">
          <div>
            <label className="text-slate-400 font-medium block mb-1">Baseline Model (A):</label>
            <select
              value={modelA}
              onChange={(e) => setModelA(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none"
            >
              <option value="xclip-base-patch32">xclip-base-patch32 (512d) • Default</option>
              <option value="Qwen/Qwen3-VL-Embedding-2B">Qwen3-VL-Embedding-2B (1536d)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1">Candidate Model (B):</label>
            <select
              value={modelB}
              onChange={(e) => setModelB(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none"
            >
              <option value="Qwen/Qwen3-VL-Embedding-2B">Qwen3-VL-Embedding-2B (1536d)</option>
              <option value="xclip-base-patch32">xclip-base-patch32 (512d) • Default</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1">Top-K Candidates:</label>
            <input
              type="number"
              min={1}
              max={10}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none"
            />
          </div>
        </div>

        {/* Test Query Tag Manager */}
        <div className="pt-2 border-t border-slate-800">
          <label className="text-slate-400 font-medium text-xs block mb-2">
            Test Queries ({queries.length}):
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {queries.map((q, idx) => (
              <span
                key={idx}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200"
              >
                <span>&quot;{q}&quot;</span>
                <button
                  onClick={() => handleRemoveQuery(idx)}
                  className="text-slate-500 hover:text-rose-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <form onSubmit={handleAddQuery} className="flex gap-2">
            <input
              type="text"
              placeholder="Add benchmark query..."
              value={newQueryInput}
              onChange={(e) => setNewQueryInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </form>
        </div>
      </div>

      {/* Results Dashboard */}
      {evalResult && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Top-1 Agreement
              </span>
              <p className="text-2xl font-bold text-white mt-1">
                {(evalResult.top1_agreement_rate * 100).toFixed(0)}%
              </p>
              <span className="text-[10px] text-slate-500">Pick identical clip</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Pool Overlap Rate
              </span>
              <p className="text-2xl font-bold text-white mt-1">
                {(evalResult.average_overlap_rate * 100).toFixed(0)}%
              </p>
              <span className="text-[10px] text-slate-500">Top-{topK} shared candidates</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Model A Latency
              </span>
              <p className="text-2xl font-bold text-white mt-1">
                {evalResult.avg_latency_a_ms.toFixed(0)} ms
              </p>
              <span className="text-[10px] text-slate-500">{evalResult.model_a}</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Model B Latency
              </span>
              <p className="text-2xl font-bold text-white mt-1">
                {evalResult.avg_latency_b_ms.toFixed(0)} ms
              </p>
              <span className="text-[10px] text-slate-500">{evalResult.model_b}</span>
            </div>
          </div>

          {/* Per-Query Side-by-Side Breakdown */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">Query Comparisons</h3>

            {evalResult.queries.map((qItem: EvalQueryItem, qIdx: number) => (
              <div
                key={qIdx}
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-4"
              >
                {/* Query Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      #{qIdx + 1}
                    </span>
                    <h4 className="text-sm font-medium text-white">&quot;{qItem.query}&quot;</h4>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {qItem.top1_agreement ? (
                      <span className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Top-1 Match
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-[11px]">
                        <XCircle className="w-3.5 h-3.5" /> Divergent Picks
                      </span>
                    )}
                    <span className="text-slate-400 text-[11px]">
                      {qItem.overlap_count} shared in top {topK}
                    </span>
                  </div>
                </div>

                {/* Side-by-Side Candidate Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Model A Results */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-indigo-400">{evalResult.model_a}</span>
                      <span className="text-slate-500 font-mono text-[11px]">{qItem.latency_a_ms} ms</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {qItem.model_a_candidates.map((cand, idx) => (
                        <div
                          key={cand.chunk_id}
                          className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-2 text-xs flex flex-col justify-between"
                        >
                          <div className="aspect-video bg-slate-900 rounded overflow-hidden mb-1.5 relative flex items-center justify-center">
                            {cand.storage_url ? (
                              <video src={cand.storage_url} playsInline className="w-full h-full object-cover" />
                            ) : cand.thumbnail_url ? (
                              <img src={cand.thumbnail_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Play className="w-4 h-4 text-slate-600" />
                            )}
                            <div className="absolute top-1 left-1 bg-black/70 text-[9px] font-mono px-1 rounded text-white">
                              #{idx + 1}
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-slate-200 truncate">{cand.title}</p>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                              <span>Sim: {(cand.score * 100).toFixed(0)}%</span>
                              <span className="uppercase">{cand.provider}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Model B Results */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-400">{evalResult.model_b}</span>
                      <span className="text-slate-500 font-mono text-[11px]">{qItem.latency_b_ms} ms</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {qItem.model_b_candidates.map((cand, idx) => (
                        <div
                          key={cand.chunk_id}
                          className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-2 text-xs flex flex-col justify-between"
                        >
                          <div className="aspect-video bg-slate-900 rounded overflow-hidden mb-1.5 relative flex items-center justify-center">
                            {cand.storage_url ? (
                              <video src={cand.storage_url} playsInline className="w-full h-full object-cover" />
                            ) : cand.thumbnail_url ? (
                              <img src={cand.thumbnail_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Play className="w-4 h-4 text-slate-600" />
                            )}
                            <div className="absolute top-1 left-1 bg-black/70 text-[9px] font-mono px-1 rounded text-white">
                              #{idx + 1}
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-slate-200 truncate">{cand.title}</p>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                              <span>Sim: {(cand.score * 100).toFixed(0)}%</span>
                              <span className="uppercase">{cand.provider}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
