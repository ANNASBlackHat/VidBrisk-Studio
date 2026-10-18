"use client";

import { useState, useEffect, useRef } from "react";
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
  UploadCloud,
  FileAudio,
  Trash2,
  RefreshCw,
  Music,
  Cpu,
  Wand2,
  Tag,
  Volume2,
  Check,
  Play,
  Pause,
} from "lucide-react";
import { api, API_BASE_URL } from "@/lib/api";
import { JobCreateRequest, TargetOrientation, VoiceProfile, VideoEngineName, EngineInfo } from "@/lib/types";
import { PresetSelector } from "@/components/ui/PresetSelector";
import { cn, formatDuration, formatFileSize } from "@/lib/utils";

const ENGINE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  remotion: Monitor,
  hyperframes: Sparkles,
  native_fast: Zap,
};

const ENGINE_LABELS: Record<string, { label: string; tag: string }> = {
  remotion: { label: "Remotion", tag: "Default • React" },
  hyperframes: { label: "HyperFrames", tag: "HTML5 Canvas" },
  native_fast: { label: "Native Fast", tag: "Pure FFmpeg" },
};

const TTS_VOICE_PRESETS = [
  { id: "af_heart", name: "Heart", gender: "Female", accent: "American", desc: "Warm, natural narration" },
  { id: "af_bella", name: "Bella", gender: "Female", accent: "American", desc: "Expressive & dynamic" },
  { id: "af_nicole", name: "Nicole", gender: "Female", accent: "American", desc: "Crisp & professional" },
  { id: "am_adam", name: "Adam", gender: "Male", accent: "American", desc: "Deep & articulate" },
  { id: "am_michael", name: "Michael", gender: "Male", accent: "American", desc: "Authoritative & clear" },
  { id: "bf_emma", name: "Emma", gender: "Female", accent: "British", desc: "Refined & articulate" },
  { id: "bm_george", name: "George", gender: "Male", accent: "British", desc: "Documentary tone" },
];

export default function NewVideoPage() {
  const router = useRouter();

  const [title, setTitle] = useState<string>("");
  const [rawInput, setRawInput] = useState<string>("");
  const [targetOrientation, setTargetOrientation] =
    useState<TargetOrientation>("horizontal");
  const [autoApprove, setAutoApprove] = useState<boolean>(false); // Default false per SPEC §7

  // Voiceover Source State
  const [voiceSource, setVoiceSource] = useState<"tts" | "upload">("tts");
  const [ttsVoice, setTtsVoice] = useState<string>("af_heart");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // OmniVoice State & Custom Profiles
  const [omniMode, setOmniMode] = useState<"clone" | "prompt">("clone");
  const [selectedVoiceProfile, setSelectedVoiceProfile] = useState<string>("deep_documentary");
  const [voicePrompt, setVoicePrompt] = useState<string>("calm, articulate British male narrator, slow pace, documentary tone");
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>([]);
  const [validTags, setValidTags] = useState<string[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState<boolean>(false);
  const [isRecommendingPrompt, setIsRecommendingPrompt] = useState<boolean>(false);
  const [recommendationReason, setRecommendationReason] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const voiceAudioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [ttsProvider, setTtsProvider] = useState<string>("kokoro");
  const [alignerProvider, setAlignerProvider] = useState<string>("easytranscriber");
  const [singlePassLlm, setSinglePassLlm] = useState<boolean>(false);

  // Status state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Engine Selection State (default: remotion)
  const [engine, setEngine] = useState<VideoEngineName>("remotion");
  const [availableEngines, setAvailableEngines] = useState<EngineInfo[]>([
    { name: "remotion", description: "Full React documentary motion graphics & rich charts", is_default: true },
    { name: "hyperframes", description: "Declarative HTML5/GSAP canvas, zero npm requirements", is_default: false },
    { name: "native_fast", description: "Pure FFmpeg filtergraphs, ultra-fast headless render", is_default: false },
  ]);

  const wordCount = rawInput.trim() ? rawInput.trim().split(/\s+/).length : 0;
  const charCount = rawInput.length;

  // Load available engines
  useEffect(() => {
    let isMounted = true;
    async function loadEngines() {
      try {
        const data = await api.getEngines();
        if (isMounted && data?.engines && data.engines.length > 0) {
          setAvailableEngines(data.engines);
          if (data.default) {
            setEngine(data.default);
          }
        }
      } catch (err) {
        console.warn("Could not load engines from backend:", err);
      }
    }
    loadEngines();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
    };
  }, [audioPreviewUrl]);

  // Load available custom voice profiles & valid Omni tags
  useEffect(() => {
    let isMounted = true;
    async function loadVoices() {
      try {
        setIsLoadingVoices(true);
        const data = await api.getVoices();
        if (isMounted) {
          setVoiceProfiles(data.custom_voices || []);
          setValidTags(data.valid_tags || []);
          if (data.custom_voices && data.custom_voices.length > 0) {
            setSelectedVoiceProfile(data.custom_voices[0].id);
          }
          if (data.default_instruct) {
            setVoicePrompt(data.default_instruct);
          }
        }
      } catch (err) {
        console.warn("Could not load voice profiles from backend:", err);
      } finally {
        if (isMounted) setIsLoadingVoices(false);
      }
    }
    loadVoices();
    return () => {
      isMounted = false;
    };
  }, []);

  // Cleanup active audio player on unmount
  useEffect(() => {
    return () => {
      if (voiceAudioPlayerRef.current) {
        voiceAudioPlayerRef.current.pause();
        voiceAudioPlayerRef.current = null;
      }
    };
  }, []);

  const handleToggleVoicePreview = (e: React.MouseEvent, profile: VoiceProfile) => {
    e.stopPropagation();

    if (playingVoiceId === profile.id) {
      if (voiceAudioPlayerRef.current) {
        voiceAudioPlayerRef.current.pause();
      }
      setPlayingVoiceId(null);
      return;
    }

    if (voiceAudioPlayerRef.current) {
      voiceAudioPlayerRef.current.pause();
    }

    const audioUrl = profile.preview_url
      ? (profile.preview_url.startsWith("http") ? profile.preview_url : `${API_BASE_URL}${profile.preview_url}`)
      : `${API_BASE_URL}/api/voices/${profile.id}/audio`;

    const player = new Audio(audioUrl);
    voiceAudioPlayerRef.current = player;
    setPlayingVoiceId(profile.id);

    player.play().catch((err) => {
      console.warn("Audio preview playback failed:", err);
      setPlayingVoiceId(null);
    });

    player.onended = () => {
      setPlayingVoiceId(null);
    };

    player.onerror = () => {
      setPlayingVoiceId(null);
    };
  };

  const handleRecommendPrompt = async () => {
    if (!rawInput.trim()) {
      setErrorMessage("Please enter a script or topic first so AI can analyze the tone and pacing.");
      return;
    }
    setIsRecommendingPrompt(true);
    setRecommendationReason(null);
    try {
      const res = await api.recommendVoicePrompt({ script: rawInput });
      if (res.recommended_prompt) {
        setVoicePrompt(res.recommended_prompt);
      }
      if (res.reasoning) {
        setRecommendationReason(res.reasoning);
      }
    } catch (err: unknown) {
      console.warn("Could not recommend voice prompt:", err);
      const msg = err instanceof Error ? err.message : "Failed to recommend prompt";
      setErrorMessage(msg);
    } finally {
      setIsRecommendingPrompt(false);
    }
  };

  const togglePromptTag = (tag: string) => {
    const currentTags = voicePrompt
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const tagLower = tag.toLowerCase();

    if (currentTags.includes(tagLower)) {
      setVoicePrompt(currentTags.filter((t) => t !== tagLower).join(", "));
    } else {
      setVoicePrompt(currentTags.length > 0 ? `${voicePrompt.trim()}, ${tag}` : tag);
    }
  };

  const handleAudioFileSelect = (file: File | null) => {
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
    }
    if (!file) {
      setAudioFile(null);
      setAudioPreviewUrl(null);
      setAudioDuration(null);
      return;
    }

    // 50 MB limit
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMessage("Audio file exceeds maximum size of 50 MB.");
      return;
    }

    const url = URL.createObjectURL(file);
    setAudioFile(file);
    setAudioPreviewUrl(url);
    setErrorMessage(null);

    // Auto-detect duration
    const tempAudio = new Audio(url);
    tempAudio.onloadedmetadata = () => {
      setAudioDuration(tempAudio.duration);
    };

    // If title is empty, suggest filename without extension
    if (!title) {
      const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
      setTitle(baseName.charAt(0).toUpperCase() + baseName.slice(1));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleAudioFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (voiceSource === "upload" && !audioFile) {
      setErrorMessage("Please upload an audio file or switch to AI Voice Synthesis.");
      return;
    }

    if (voiceSource === "tts" && (!rawInput.trim() || rawInput.trim().length < 5)) {
      setErrorMessage("Please enter a script or topic (at least 5 characters).");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const isOmni = ttsProvider === "omni";
    const payload: JobCreateRequest = {
      title: title.trim() || undefined,
      raw_input: rawInput.trim() || (audioFile ? `Custom voiceover: ${audioFile.name}` : ""),
      engine,
      target_orientation: targetOrientation,
      auto_approve: autoApprove,
      tts_provider: voiceSource === "upload" ? "custom" : ttsProvider,
      aligner_provider: alignerProvider,
      single_pass_llm: singlePassLlm,
      voice_type: voiceSource === "upload"
        ? "custom"
        : isOmni
          ? (omniMode === "clone" ? selectedVoiceProfile : "prompt")
          : ttsVoice,
      voice: isOmni ? (omniMode === "clone" ? selectedVoiceProfile : undefined) : undefined,
      voice_prompt: isOmni && omniMode === "prompt" ? voicePrompt.trim() : undefined,
    };

    try {
      const job = await api.createJob(payload, voiceSource === "upload" ? audioFile : null);
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
        <PresetSelector onSelect={(script) => {
          setRawInput(script);
          const firstLine = script.trim().split("\n")[0]?.replace(/\[VISUAL:.*?\]/g, "").trim();
          if (firstLine && !title) {
            setTitle(firstLine.slice(0, 60));
          }
        }} />

        {/* Video Title / Project Name */}
        <div className="flex flex-col gap-2 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <label
            htmlFor="title-input"
            className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Video Title (Optional)
            </span>
            <span className="text-[11px] text-slate-500 font-normal lowercase">
              Auto-generated if left blank
            </span>
          </label>
          <input
            id="title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Apollo 11 Lunar Landing Documentary"
            maxLength={255}
            className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
          />
        </div>

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
            placeholder={
              voiceSource === "upload"
                ? "Optional: Paste the reference transcript for your uploaded audio (helps align words accurately)..."
                : "Paste your raw script, article, or visual notes here...\n\ne.g.\n[VISUAL: Rocket taking off]\nIn July 1969, three astronauts embarked on humanity's most daring voyage to the Moon.\nNeil Armstrong stepped onto the lunar surface..."
            }
            className="w-full mt-1 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-y"
          />
        </div>

        {/* Voiceover Audio Source: AI Synthesis vs Upload */}
        <div className="flex flex-col gap-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Mic className="w-3.5 h-3.5 text-blue-400" />
              <span>Voiceover Audio Source</span>
            </label>
            <span className="text-[11px] text-slate-500 font-normal">
              {voiceSource === "tts" ? "AI Generated Voice" : "Pre-recorded Audio File"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setVoiceSource("tts")}
              className={cn(
                "flex items-start gap-3 p-3.5 rounded-xl border transition-all text-left",
                voiceSource === "tts"
                  ? "bg-blue-950/40 border-blue-500 text-blue-100 shadow-sm shadow-blue-500/20"
                  : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              )}
            >
              <div className={cn("p-2 rounded-lg mt-0.5", voiceSource === "tts" ? "bg-blue-600/20 text-blue-400" : "bg-slate-800/60 text-slate-500")}>
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-100">AI Voice Synthesis</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Generate voiceover with Kokoro TTS</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setVoiceSource("upload")}
              className={cn(
                "flex items-start gap-3 p-3.5 rounded-xl border transition-all text-left",
                voiceSource === "upload"
                  ? "bg-purple-950/40 border-purple-500 text-purple-100 shadow-sm shadow-purple-500/20"
                  : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              )}
            >
              <div className={cn("p-2 rounded-lg mt-0.5", voiceSource === "upload" ? "bg-purple-600/20 text-purple-400" : "bg-slate-800/60 text-slate-500")}>
                <UploadCloud className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-100">Upload Custom Audio</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Use your pre-recorded MP3 / WAV file</div>
              </div>
            </button>
          </div>

          {/* Conditional Voice Configuration */}
          {voiceSource === "tts" ? (
            <div className="flex flex-col gap-4 pt-3 border-t border-slate-800/60">
              {/* TTS Engine Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    TTS Engine
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setTtsProvider("kokoro")}
                    className={cn(
                      "px-3 py-1.5 text-xs rounded-lg transition-all font-medium",
                      ttsProvider === "kokoro"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    Kokoro (Local Fast)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTtsProvider("omni")}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all font-medium",
                      ttsProvider === "omni"
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    OmniVoice (Colab GPU)
                  </button>
                </div>
              </div>

              {/* Mode Specific Configuration */}
              {ttsProvider === "omni" ? (
                <div className="flex flex-col gap-3.5 p-4 rounded-xl bg-slate-950/80 border border-indigo-900/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-indigo-300">
                        OmniVoice Synthesis Mode
                      </span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                        Zero-Shot Neural
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setOmniMode("clone")}
                        className={cn(
                          "px-2.5 py-1 text-[11px] rounded-md transition-all font-medium",
                          omniMode === "clone"
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        )}
                      >
                        Audio Voice Clone
                      </button>
                      <button
                        type="button"
                        onClick={() => setOmniMode("prompt")}
                        className={cn(
                          "px-2.5 py-1 text-[11px] rounded-md transition-all font-medium",
                          omniMode === "prompt"
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        )}
                      >
                        Prompt Voice Design
                      </button>
                    </div>
                  </div>

                  {omniMode === "clone" ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                          <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Select Reference Voice Profile to Clone</span>
                        </label>
                        {isLoadingVoices && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                            <span>Scanning data/voices...</span>
                          </div>
                        )}
                      </div>

                      {voiceProfiles.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {voiceProfiles.map((p) => {
                            const isSelected = selectedVoiceProfile === p.id;
                            const isPlaying = playingVoiceId === p.id;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setSelectedVoiceProfile(p.id)}
                                className={cn(
                                  "flex flex-col p-3 rounded-xl border text-left transition-all relative overflow-hidden group",
                                  isSelected
                                    ? "bg-indigo-950/40 border-indigo-500 text-white shadow-sm shadow-indigo-500/20"
                                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                                )}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-100">
                                      {p.name}
                                    </span>
                                    {p.has_text && (
                                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/50">
                                        Transcript Verified
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => handleToggleVoicePreview(e, p)}
                                      className={cn(
                                        "flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all z-10",
                                        isPlaying
                                          ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/40 animate-pulse"
                                          : "bg-slate-800 text-slate-300 hover:bg-indigo-900 hover:text-indigo-200 border border-slate-700"
                                      )}
                                      title={isPlaying ? "Stop Preview" : "Listen to Voice"}
                                    >
                                      {isPlaying ? (
                                        <>
                                          <Pause className="w-2.5 h-2.5 fill-current" />
                                          <span>Stop</span>
                                        </>
                                      ) : (
                                        <>
                                          <Play className="w-2.5 h-2.5 fill-current" />
                                          <span>Play</span>
                                        </>
                                      )}
                                    </button>

                                    {isSelected && (
                                      <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[11px] text-slate-400 font-mono truncate">
                                    {p.filename}
                                  </span>
                                  {isPlaying && (
                                    <span className="text-[10px] text-indigo-400 flex items-center gap-1 font-mono">
                                      <Volume2 className="w-3 h-3 animate-pulse" />
                                      <span>Playing...</span>
                                    </span>
                                  )}
                                </div>

                                {p.transcript && (
                                  <p className="text-[10px] text-slate-500 mt-1.5 line-clamp-1 italic">
                                    &ldquo;{p.transcript}&rdquo;
                                  </p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400">
                          No audio files detected in <code className="text-indigo-300 font-mono">data/voices/</code>. Add an MP3/WAV file to clone custom voices.
                        </div>
                      )}

                      <p className="text-[11px] text-slate-500">
                        Zero-shot voice cloning matches the timbre, acoustic room resonance, and cadence of your reference sample without training.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Voice Prompt / Acoustic Description</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleRecommendPrompt}
                          disabled={isRecommendingPrompt || !rawInput.trim()}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-900/40 hover:bg-indigo-900/70 border border-indigo-700/60 text-indigo-200 text-[11px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isRecommendingPrompt ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin text-indigo-300" />
                              <span>Analyzing script...</span>
                            </>
                          ) : (
                            <>
                              <Wand2 className="w-3 h-3 text-indigo-300" />
                              <span>Auto-detect from Script</span>
                            </>
                          )}
                        </button>
                      </div>

                      <textarea
                        rows={2}
                        value={voicePrompt}
                        onChange={(e) => setVoicePrompt(e.target.value)}
                        placeholder="e.g. calm, articulate British male narrator, slow pace, documentary tone"
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder-slate-500 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none"
                      />

                      {recommendationReason && (
                        <div className="text-[11px] text-indigo-300 bg-indigo-950/40 border border-indigo-800/40 p-2 rounded-lg">
                          💡 <span className="font-semibold">AI Recommendation:</span> {recommendationReason}
                        </div>
                      )}

                      {/* Tag quick chips */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                          Quick Whitelist Attributes
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            "male",
                            "female",
                            "low pitch",
                            "high pitch",
                            "british accent",
                            "american accent",
                            "whisper",
                            "slow",
                            "fast",
                            "clear",
                            "calm",
                            "documentary",
                          ].map((tag) => {
                            const isIncluded = voicePrompt.toLowerCase().includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => togglePromptTag(tag)}
                                className={cn(
                                  "px-2 py-0.5 rounded-md text-[10px] font-medium transition-all border",
                                  isIncluded
                                    ? "bg-indigo-900/60 border-indigo-500 text-indigo-200"
                                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                                )}
                              >
                                {isIncluded ? `✓ ${tag}` : `+ ${tag}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <label className="text-xs font-medium text-slate-400">
                    Select Voice Persona
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {TTS_VOICE_PRESETS.map((v) => {
                      const isSelected = ttsVoice === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setTtsVoice(v.id)}
                          className={cn(
                            "flex flex-col p-2.5 rounded-xl border text-left transition-all",
                            isSelected
                              ? "bg-blue-900/30 border-blue-500 text-white"
                              : "bg-slate-950/30 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold">{v.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{v.gender[0]}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-0.5">{v.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 pt-2 border-t border-slate-800/60">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.aac,.flac"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleAudioFileSelect(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {!audioFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer text-center",
                    isDragging
                      ? "border-purple-500 bg-purple-950/30"
                      : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-950/70"
                  )}
                >
                  <div className="w-12 h-12 rounded-full bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-purple-400 mb-3">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-semibold text-slate-200">
                    Click to browse or drag & drop audio
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    MP3, WAV, M4A, AAC, or FLAC (Max 50 MB)
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-3 p-4 rounded-xl bg-slate-950/80 border border-purple-800/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-lg bg-purple-950/80 border border-purple-800/60 text-purple-400 shrink-0">
                        <FileAudio className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-slate-100 truncate">
                          {audioFile.name}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span>{formatFileSize(audioFile.size)}</span>
                          {audioDuration !== null && (
                            <>
                              <span>•</span>
                              <span>{formatDuration(audioDuration)}</span>
                            </>
                          )}
                          <span>•</span>
                          <span className="uppercase font-mono text-[10px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800/60">
                            {audioFile.name.split(".").pop() || "Audio"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                        title="Replace Audio File"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAudioFileSelect(null)}
                        className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="Remove Audio File"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {audioPreviewUrl && (
                    <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-900">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Music className="w-3 h-3 text-purple-400" />
                        <span>Voiceover Preview & Audio Check</span>
                      </div>
                      <audio
                        controls
                        src={audioPreviewUrl}
                        className="w-full h-10 rounded-lg accent-purple-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Render Engine Selector */}
        <div className="flex flex-col gap-3 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span>Rendering Engine</span>
            </label>
            <span className="text-[10px] text-slate-500 font-mono">
              Pipeline Execution Engine
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {availableEngines.map((eng) => {
              const isSelected = engine === eng.name;
              const Icon = ENGINE_ICONS[eng.name] || Cpu;
              const meta = ENGINE_LABELS[eng.name] || {
                label: eng.name.toUpperCase(),
                tag: eng.is_default ? "Default" : "Engine",
              };
              return (
                <button
                  key={eng.name}
                  type="button"
                  onClick={() => setEngine(eng.name)}
                  className={cn(
                    "flex flex-col p-3.5 rounded-xl border text-left transition-all relative overflow-hidden group",
                    isSelected
                      ? "bg-blue-950/40 border-blue-500 text-white shadow-sm shadow-blue-500/20"
                      : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("w-4 h-4", isSelected ? "text-blue-400" : "text-slate-500")} />
                      <span className="text-xs font-semibold text-slate-100">{meta.label}</span>
                    </div>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-white">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-blue-400/90 mb-1">{meta.tag}</span>
                  <span className="text-[11px] text-slate-400 leading-snug">{eng.description}</span>
                </button>
              );
            })}
          </div>
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
                  <option value="omni">OmniVoice (Colab GPU - Voice Cloning & Custom Prompt)</option>
                  <option value="supersonic">Supersonic 3 / Supertonic (Ultra-fast, On-Device, 31 Langs)</option>
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
            disabled={isSubmitting || (voiceSource === "tts" ? !rawInput.trim() : !audioFile)}
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
