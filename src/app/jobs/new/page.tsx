"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Monitor,
  Smartphone,
  Square,
  ShieldCheck,
  Zap,
  Mic,
  Activity,
  ArrowLeft,
  Loader2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { api } from "@/lib/api";
import { JobCreateRequest, TargetOrientation } from "@/lib/types";
import { PresetSelector } from "@/components/ui/PresetSelector";

export default function NewVideoPage() {
  const router = useRouter();

  const [rawInput, setRawInput] = useState<string>("");
  const [targetOrientation, setTargetOrientation] =
    useState<TargetOrientation>("horizontal");
  const [autoApprove, setAutoApprove] = useState<boolean>(false); // Default false per SPEC §7

  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [ttsProvider, setTtsProvider] = useState<string>("kokoro");
  const [alignerProvider, setAlignerProvider] = useState<string>("easytranscriber");
  const [singlePassLlm, setSinglePassLlm] = useState<boolean>(false);

  // Status state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wordCount = rawInput.trim() ? rawInput.trim().split(/\s+/).length : 0;
  const charCount = rawInput.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawInput.trim() || rawInput.trim().length < 5) {
      setErrorMessage("Please enter a script or topic (at least 5 characters).");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const payload: JobCreateRequest = {
      raw_input: rawInput.trim(),
      target_orientation: targetOrientation,
      auto_approve: autoApprove,
      tts_provider: ttsProvider,
      aligner_provider: alignerProvider,
      single_pass_llm: singlePassLlm,
    };

    try {
      const job = await api.createJob(payload);
      router.push(`/jobs/${job.id}`);
    } catch (err: unknown) {
      console.error("Submission failed:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to create video job. Make sure the backend server is running.";
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      {/* Back Button & Title */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Generate New Video
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Paste raw narration or visual directions — the pipeline handles the rest.
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-200 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Creation Error</p>
            <p className="mt-0.5 text-rose-300">{errorMessage}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Sample Presets */}
        <PresetSelector onSelect={(script) => setRawInput(script)} />

        {/* Script / Prompt Textarea */}
        <div className="flex flex-col gap-2 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <label
              htmlFor="script-input"
              className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Input Script or Topic</span>
            </label>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span>{wordCount} words</span>
              <span>•</span>
              <span>{charCount} characters</span>
              {rawInput && (
                <button
                  type="button"
                  onClick={() => setRawInput("")}
                  className="text-slate-500 hover:text-rose-400 transition-colors ml-2"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <textarea
            id="script-input"
            rows={8}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Paste your raw script, article, or visual notes here...

e.g.
[VISUAL: Rocket taking off]
In July 1969, three astronauts embarked on humanity's most daring voyage to the Moon.
Neil Armstrong stepped onto the lunar surface..."
            className="w-full mt-1 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-y"
          />
        </div>

        {/* Orientation / Aspect Ratio Picker */}
        <div className="flex flex-col gap-3 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Target Video Format
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                id: "horizontal" as TargetOrientation,
                label: "Landscape (16:9)",
                desc: "YouTube / Desktop",
                icon: Monitor,
              },
              {
                id: "vertical" as TargetOrientation,
                label: "Portrait (9:16)",
                desc: "TikTok / Shorts / Reels",
                icon: Smartphone,
              },
              {
                id: "square" as TargetOrientation,
                label: "Square (1:1)",
                desc: "Feed / Social",
                icon: Square,
              },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = targetOrientation === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTargetOrientation(item.id)}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all ${
                    isSelected
                      ? "bg-blue-950/40 border-blue-500 text-blue-200 shadow-sm shadow-blue-500/20"
                      : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1.5 ${isSelected ? "text-blue-400" : "text-slate-500"}`} />
                  <span className="text-xs font-semibold">{item.label}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">{item.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Checkpoint Review Mode vs Fully Automated */}
        <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-start gap-3.5">
            <div
              className={`p-2.5 rounded-xl border ${
                !autoApprove
                  ? "bg-amber-950/40 border-amber-800/60 text-amber-400"
                  : "bg-blue-950/40 border-blue-800/60 text-blue-400"
              }`}
            >
              {!autoApprove ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <Zap className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-100">
                  {!autoApprove
                    ? "Human Checkpoints (Recommended)"
                    : "Fully Automated"}
                </span>
                <span
                  className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded border ${
                    !autoApprove
                      ? "bg-amber-950/60 text-amber-300 border-amber-800"
                      : "bg-blue-950/60 text-blue-300 border-blue-800"
                  }`}
                >
                  {!autoApprove ? "Checkpoints Enabled" : "Unattended"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                {!autoApprove
                  ? "Pipeline pauses after structuring and footage match so you can review and tweak candidates before assembly."
                  : "Runs all 7 pipeline stages straight through without pausing."}
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={!autoApprove}
              onChange={(e) => setAutoApprove(!e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
          </label>
        </div>

        {/* Advanced Settings Accordion */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center justify-between w-full p-4 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              Advanced Engine & Provider Settings
            </span>
            {showAdvanced ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showAdvanced && (
            <div className="p-5 pt-1 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* TTS Provider */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-blue-400" />
                  TTS Engine
                </label>
                <select
                  value={ttsProvider}
                  onChange={(e) => setTtsProvider(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="kokoro">Kokoro (Local, Apache 2.0 - Default)</option>
                  <option value="chatterbox">Chatterbox (Local, MIT)</option>
                  <option value="mock">Mock Engine (Fast test)</option>
                </select>
              </div>

              {/* Aligner Provider */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-blue-400" />
                  Forced Aligner
                </label>
                <select
                  value={alignerProvider}
                  onChange={(e) => setAlignerProvider(e.target.value)}
                  className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="easytranscriber">easytranscriber (Default, Fast)</option>
                  <option value="whisperx">WhisperX (Fallback)</option>
                  <option value="mock">Mock Aligner (Fast test)</option>
                </select>
              </div>

              {/* Single Pass LLM */}
              <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-slate-200">
                    Single-Pass LLM Structuring
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Combines script cleaning and beat structuring in a single prompt for speed.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={singlePassLlm}
                  onChange={(e) => setSinglePassLlm(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/"
            className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || !rawInput.trim()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/25 active:scale-95 transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Pipeline Job...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Start Video Generation</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
