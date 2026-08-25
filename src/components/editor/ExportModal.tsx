"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  EditorProjectState,
  editorStateToTimeline,
} from "@/adapters/timelineToEditorState";
import { api } from "@/lib/api";
import { RenderEngineType } from "@/lib/types";
import { formatRenderTime } from "@/lib/utils";
import {
  Download,
  X,
  AlertCircle,
  AlertTriangle,
  Film,
  Sparkles,
  Settings,
  Play,
  RotateCcw,
  Clock,
  Timer,
  Cloud,
  Package,
  Zap,
  ExternalLink,
} from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectState: EditorProjectState;
}

type ExportQuality = "1080p" | "720p" | "4k";
type ExportFps = 30 | 60;
type ExportTab = "direct" | "colab";

export function ExportModal({
  isOpen,
  onClose,
  projectState,
}: ExportModalProps) {
  const [quality, setQuality] = useState<ExportQuality>("720p");
  const [fps, setFps] = useState<ExportFps>(30);
  const [activeTab, setActiveTab] = useState<ExportTab>("direct");
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [renderStage, setRenderStage] = useState<string>("");
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [renderEngine, setRenderEngine] = useState<RenderEngineType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [totalRenderTime, setTotalRenderTime] = useState<number | null>(null);
  const [isExportingColab, setIsExportingColab] = useState<boolean>(false);
  const [colabError, setColabError] = useState<string | null>(null);
  const [colabWarnings, setColabWarnings] = useState<string[]>([]);
  const [colabSuccess, setColabSuccess] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const nonHttpAssetCount = useMemo(() => {
    const items = projectState.tracks.flatMap((t) => t.items);
    return items.filter((it) => {
      const vals = [it.storageUrl, it.storagePath, it.assetId].filter(Boolean) as string[];
      return vals.some((v) => v && !v.startsWith("http://") && !v.startsWith("https://") && !v.startsWith("assets/"));
    }).length;
  }, [projectState]);

  const hasLocalAssets = nonHttpAssetCount > 0;

  const cleanupStreams = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // Reset or initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (!isRendering) {
        setProgress(0);
        setRenderStage("");
        setRenderEngine(null);
        setErrorMessage(null);
        setElapsedSeconds(0);
        setTotalRenderTime(null);
      }
      setColabError(null);
      setColabWarnings([]);
      setColabSuccess(null);
    } else {
      cleanupStreams();
    }
    return () => {
      cleanupStreams();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartRender = async () => {
    cleanupStreams();
    setIsRendering(true);
    setProgress(5);
    setRenderStage("Enqueuing video render in background worker...");
    setErrorMessage(null);
    setRenderEngine(null);
    setElapsedSeconds(0);
    setTotalRenderTime(null);

    const startTs = Date.now();
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((Date.now() - startTs) / 1000);
    }, 100);

    try {
      let width = 1280;
      let height = 720;
      if (quality === "1080p") {
        width = projectState.orientation === "vertical" ? 1080 : 1920;
        height = projectState.orientation === "vertical" ? 1920 : 1080;
      } else if (quality === "4k") {
        width = projectState.orientation === "vertical" ? 2160 : 3840;
        height = projectState.orientation === "vertical" ? 3840 : 2160;
      } else {
        width = projectState.orientation === "vertical" ? 720 : 1280;
        height = projectState.orientation === "vertical" ? 1280 : 720;
      }

      if (projectState.orientation === "square") {
        const dim = quality === "720p" ? 720 : quality === "4k" ? 2160 : 1080;
        width = dim;
        height = dim;
      }

      // 1. Enqueue render on backend worker (HTTP request finishes in <20ms)
      const timelinePayload = editorStateToTimeline(projectState);
      await api.renderVideo(
        projectState.jobId,
        { timeline: timelinePayload },
        { width, height, fps }
      );

      // 2. Connect to real-time Server-Sent Events (SSE) stream for live progress
      const streamUrl = api.getJobStreamUrl(projectState.jobId);
      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.progress?.percent !== undefined) {
            setProgress(data.progress.percent);
          }
          if (data.progress?.message) {
            setRenderStage(data.progress.message);
          }
          if (data.progress?.render_engine) {
            setRenderEngine(data.progress.render_engine);
          }

          // Check if export has finalized
          const isDone =
            data.progress?.is_rendering === false &&
            data.progress?.percent === 100 &&
            Boolean(data.video_url || data.progress?.video_url);

          if (isDone) {
            const finalElapsed = (Date.now() - startTs) / 1000;
            setElapsedSeconds(finalElapsed);
            setTotalRenderTime(finalElapsed);
            setProgress(100);
            setRenderStage("Export complete!");
            setRenderEngine(data.progress?.render_engine || "remotion-native");
            setRenderedVideoUrl(data.video_url || data.progress?.video_url);
            setIsRendering(false);
            cleanupStreams();
          } else if (data.progress?.error || (data.progress?.is_rendering === false && data.status === "failed")) {
            setErrorMessage(
              data.error_message || data.progress?.error || "Rendering failed."
            );
            setIsRendering(false);
            cleanupStreams();
          }
        } catch (err) {
          console.warn("SSE parse error:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.warn("SSE stream connection issue:", err);
      };
    } catch (err) {
      console.error("Render failed:", err);
      cleanupStreams();
      setErrorMessage(
        err instanceof Error ? err.message : "Video rendering failed."
      );
      setIsRendering(false);
    }
  };

  const handleExportColab = async () => {
    setIsExportingColab(true);
    setColabError(null);
    setColabWarnings([]);
    setColabSuccess(null);
    try {
      const res = await fetch("/api/export-colab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectState, quality, fps }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = text;
        try { const j = JSON.parse(text); msg = j.error || text; } catch {}
        throw new Error(msg || `Export failed (${res.status})`);
      }
      const warningsHeader = res.headers.get("X-Colab-Warnings");
      if (warningsHeader) {
        try {
          const decoded = decodeURIComponent(warningsHeader);
          if (decoded) setColabWarnings(decoded.split(" | ").filter(Boolean));
        } catch {}
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || `colab-render-${projectState.jobId.slice(0, 8)}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setColabSuccess(`Downloaded ${filename} (${(blob.size / 1024).toFixed(0)} KB) — upload to Google Colab and Run All.`);
    } catch (err) {
      console.error("Colab export failed:", err);
      setColabError(err instanceof Error ? err.message : "Colab bundle export failed.");
    } finally {
      setIsExportingColab(false);
    }
  };

  const handleDownload = () => {
    if (!renderedVideoUrl) return;
    const a = document.createElement("a");
    a.href = renderedVideoUrl;
    a.download = `video-${projectState.jobId.slice(0, 8)}-${quality}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isComplete = progress === 100 && renderedVideoUrl !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl shadow-blue-950/40 p-6 flex flex-col gap-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-950/80 border border-blue-800 text-blue-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Export Video</h3>
              <p className="text-xs text-slate-400 font-mono">
                Render & download final MP4 composition
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isRendering || isExportingColab}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("direct")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === "direct" ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}
          >
            <Zap className="w-3.5 h-3.5" />
            Render Here
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("colab")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === "colab" ? "bg-violet-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}
          >
            <Cloud className="w-3.5 h-3.5" />
            Export for Google Colab
          </button>
        </div>

        {errorMessage && activeTab === "direct" && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-200 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}
        {colabError && activeTab === "colab" && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-200 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{colabError}</span>
          </div>
        )}
        {colabSuccess && activeTab === "colab" && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/60 text-emerald-200 text-xs">
            <Package className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{colabSuccess}</span>
          </div>
        )}
        {colabWarnings.length > 0 && activeTab === "colab" && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-950/30 border border-amber-800/60 text-amber-200 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              {colabWarnings.slice(0, 3).map((w, i) => (
                <span key={i} className="text-[11px] leading-snug">{w}</span>
              ))}
            </div>
          </div>
        )}

        {/* DIRECT TAB */}
        {activeTab === "direct" && (
          <>
            {/* Configuration settings (shown before render) */}
            {!isRendering && !isComplete && (
              <div className="flex flex-col gap-4">
                {/* Resolution Selector */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-blue-400" />
                    <span>Export Resolution</span>
                  </label>

                  <div className="grid grid-cols-3 gap-2.5">
                    {(["720p", "1080p", "4k"] as ExportQuality[]).map((res) => (
                      <button
                        key={res}
                        type="button"
                        onClick={() => setQuality(res)}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                          quality === res
                            ? "bg-blue-600/20 border-blue-500 text-blue-200 shadow-md shadow-blue-500/10"
                            : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                        }`}
                      >
                        <span className="font-bold text-sm uppercase">{res}</span>
                        <span className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {res === "4k"
                            ? "3840x2160"
                            : res === "1080p"
                            ? "1920x1080"
                            : "1280x720"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Framerate Selector */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-blue-400" />
                    <span>Framerate</span>
                  </label>

                  <div className="grid grid-cols-2 gap-2.5">
                    {([30, 60] as ExportFps[]).map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setFps(rate)}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                          fps === rate
                            ? "bg-blue-600/20 border-blue-500 text-blue-200"
                            : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <span className="font-bold text-xs">{rate} FPS</span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {rate === 60 ? "Ultra Smooth" : "Standard Video"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video Specs Summary */}
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Total Duration:</span>
                  </div>
                  <span className="font-bold text-slate-200">
                    {formatRenderTime(projectState.totalDuration, true)}
                  </span>
                </div>

                {/* Start Render Button */}
                <button
                  type="button"
                  onClick={handleStartRender}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/25 active:scale-95 transition-all mt-2"
                >
                  <Play className="w-4 h-4 ml-0.5" />
                  <span>Render & Export Video</span>
                </button>
              </div>
            )}

            {/* Rendering Progress View */}
            {isRendering && (
              <div className="flex flex-col items-center justify-center py-6 gap-6 text-center">
                <div className="relative flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full border-4 border-slate-800 border-t-blue-500 animate-spin" />
                  <span className="absolute font-mono text-sm font-bold text-blue-400">
                    {progress}%
                  </span>
                </div>

                <div className="flex flex-col gap-2.5 w-full max-w-sm">
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${progress}%` }}
                      className="h-full bg-blue-500 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(59,130,246,0.8)]"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono px-0.5">
                    <p className="text-slate-400 animate-pulse text-left truncate max-w-[220px]">
                      {renderStage}
                    </p>
                    <div className="flex items-center gap-1.5 text-blue-400 font-semibold shrink-0 bg-blue-950/70 px-2.5 py-1 rounded-full border border-blue-800/60 shadow-sm">
                      <Timer className="w-3.5 h-3.5 animate-pulse text-blue-400" />
                      <span>{formatRenderTime(elapsedSeconds)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Completed Download View */}
            {isComplete && (
              <div className="flex flex-col gap-4">
                {renderEngine === "ffmpeg-fallback" ? (
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-950/40 border border-amber-800/80 text-amber-200">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-amber-100">
                          Video Exported (FFmpeg Fallback)
                        </h4>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-semibold uppercase tracking-wider border border-amber-500/30">
                          Fallback
                        </span>
                      </div>
                      <p className="text-xs text-amber-300/80 mt-1">
                        Exported without motion animation — Remotion renderer was unavailable at {quality} ({fps} FPS).
                      </p>
                    </div>
                  </div>
                ) : renderEngine === "remotion-colab" ? (
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-violet-950/30 border border-violet-800/60 text-violet-200">
                    <Cloud className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-violet-100">
                          Video Render Complete (Colab)
                        </h4>
                        <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-semibold uppercase tracking-wider border border-violet-500/30">
                          remotion-colab
                        </span>
                      </div>
                      <p className="text-xs text-violet-300/80 mt-1">
                        Rendered on Google Colab with full motion parity at {quality} ({fps} FPS).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/60 text-emerald-200">
                    <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-emerald-100">
                          Video Render Complete!
                        </h4>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold uppercase tracking-wider border border-emerald-500/30">
                          Remotion Native
                        </span>
                      </div>
                      <p className="text-xs text-emerald-300/80 mt-1">
                        High-fidelity Remotion native render with frame-accurate motion graphics & spring physics at {quality} ({fps} FPS).
                      </p>
                    </div>
                  </div>
                )}

                {/* Performance & Output Meta Summary */}
                <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs font-mono">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Render Time:</span>
                    <span className="font-bold text-emerald-400">
                      {totalRenderTime !== null ? formatRenderTime(totalRenderTime, true) : "--"}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2 text-slate-400">
                    <Film className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Format:</span>
                    <span className="font-bold text-slate-200">
                      {quality.toUpperCase()} • {fps} FPS
                    </span>
                  </div>
                </div>

                {/* Video preview */}
                <div className="relative aspect-video rounded-xl bg-black border border-slate-800 overflow-hidden shadow-xl flex items-center justify-center">
                  <video
                    src={renderedVideoUrl}
                    controls
                    className="w-full h-full object-cover"
                    autoPlay
                  />
                </div>

                {/* Download and reset buttons */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRendering(false);
                      setProgress(0);
                      setRenderedVideoUrl(null);
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Re-configure</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 active:scale-95 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download MP4</span>
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* COLAB TAB */}
        {activeTab === "colab" && !isComplete && !isRendering && (
          <div className="flex flex-col gap-4">
            <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-800/40 text-violet-200 text-xs leading-relaxed">
              <div className="flex items-center gap-2 font-semibold text-violet-100 mb-1">
                <Zap className="w-3.5 h-3.5 text-violet-400" />
                Offload to Google Colab — free datacenter compute
              </div>
              <p className="text-violet-300/80 text-[11px]">
                Packages your edited timeline into a standalone <code className="px-1 py-0.5 bg-violet-900/50 rounded text-violet-200">colab-render-*.zip</code> with the exact React/Remotion composition. Colab downloads assets in parallel (&gt;500 Mbps) and renders with all vCPUs + FFmpeg H.264/AAC.
              </p>
            </div>

            {/* Resolution Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-violet-400" />
                <span>Export Resolution</span>
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {(["720p", "1080p", "4k"] as ExportQuality[]).map((res) => (
                  <button
                    key={res}
                    type="button"
                    onClick={() => setQuality(res)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
                      quality === res
                        ? "bg-violet-600/20 border-violet-500 text-violet-200 shadow-md shadow-violet-500/10"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                    }`}
                  >
                    <span className="font-bold text-sm uppercase">{res}</span>
                    <span className="text-[10px] font-mono text-slate-500 mt-0.5">
                      {res === "4k" ? "3840x2160" : res === "1080p" ? "1920x1080" : "1280x720"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-violet-400" />
                <span>Framerate</span>
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {([30, 60] as ExportFps[]).map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setFps(rate)}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      fps === rate
                        ? "bg-violet-600/20 border-violet-500 text-violet-200"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span className="font-bold text-xs">{rate} FPS</span>
                    <span className="text-[10px] font-mono text-slate-500">{rate === 60 ? "Ultra Smooth" : "Standard Video"}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Total Duration:</span>
              </div>
              <span className="font-bold text-slate-200">{formatRenderTime(projectState.totalDuration, true)}</span>
            </div>

            {hasLocalAssets && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-950/20 border border-amber-800/50 text-amber-200 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-100 text-[11px]">{nonHttpAssetCount} local asset(s) detected</p>
                  <p className="text-amber-300/80 text-[11px] mt-0.5">Found: embedded into <code className="px-1 py-0.5 bg-amber-900/40 rounded">assets/</code> if on disk, otherwise flagged. Remote URLs stay as-is for Colab parallel download.</p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleExportColab}
              disabled={isExportingColab}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-600/25 active:scale-95 transition-all mt-1"
            >
              {isExportingColab ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Packaging Colab Bundle…</span>
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  <span>Download Colab Bundle (.zip)</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 font-mono">
              <span>Contains: project_state.json • render_colab.mjs • bundle_remotion.mjs • src/* • Colab_Video_Renderer.ipynb</span>
            </div>
            <a href="https://colab.research.google.com/" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 text-[11px] text-violet-400 hover:text-violet-300 transition-colors">
              <span>Open Google Colab</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
