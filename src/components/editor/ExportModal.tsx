"use client";

import React, { useState, useEffect } from "react";
import {
  EditorProjectState,
  editorStateToTimeline,
} from "@/adapters/timelineToEditorState";
import { api } from "@/lib/api";
import {
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  Film,
  Sparkles,
  Settings,
  Play,
  RotateCcw,
} from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectState: EditorProjectState;
}

type ExportQuality = "1080p" | "720p" | "4k";
type ExportFps = 30 | 60;

export function ExportModal({
  isOpen,
  onClose,
  projectState,
}: ExportModalProps) {
  const [quality, setQuality] = useState<ExportQuality>("720p");
  const [fps, setFps] = useState<ExportFps>(30);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [renderStage, setRenderStage] = useState<string>("");
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsRendering(false);
      setProgress(0);
      setRenderStage("");
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartRender = async () => {
    setIsRendering(true);
    setProgress(15);
    setRenderStage("Synthesizing Remotion React motion graphics & typography...");
    setErrorMessage(null);

    const progressTimer1 = setTimeout(() => {
      setProgress(40);
      setRenderStage("Rendering video sequences, spring physics & particle effects...");
    }, 1500);

    const progressTimer2 = setTimeout(() => {
      setProgress(70);
      setRenderStage("Multiplexing voiceover audio master tracks...");
    }, 3500);

    const progressTimer3 = setTimeout(() => {
      setProgress(90);
      setRenderStage("Encoding final high-fidelity MP4 container...");
    }, 5500);

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

      // 1. Try High-Fidelity Remotion Native Renderer
      let videoUrl: string | null = null;
      try {
        const remotionRes = await fetch("/api/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectState,
            quality,
            fps,
          }),
        });

        if (remotionRes.ok) {
          const data = await remotionRes.json();
          videoUrl = data.video_url;
        }
      } catch (e) {
        console.warn("Remotion render fallback:", e);
      }

      // 2. Fallback to Backend Renderer if needed
      if (!videoUrl) {
        const timelinePayload = editorStateToTimeline(projectState);
        const res = await api.renderVideo(
          projectState.jobId,
          { timeline: timelinePayload },
          { width, height, fps }
        );
        videoUrl = res.video_url;
      }

      clearTimeout(progressTimer1);
      clearTimeout(progressTimer2);
      clearTimeout(progressTimer3);

      setProgress(100);
      setRenderStage("Export complete!");
      setRenderedVideoUrl(videoUrl);
    } catch (err) {
      console.error("Render failed:", err);
      clearTimeout(progressTimer1);
      clearTimeout(progressTimer2);
      clearTimeout(progressTimer3);
      setErrorMessage(
        err instanceof Error ? err.message : "Video rendering failed."
      );
    } finally {
      setIsRendering(false);
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
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl shadow-blue-950/40 p-6 flex flex-col gap-6 text-slate-100">
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
            disabled={isRendering}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-200 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

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
                {projectState.totalDuration.toFixed(1)}s
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

            <div className="flex flex-col gap-2 w-full max-w-sm">
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  style={{ width: `${progress}%` }}
                  className="h-full bg-blue-500 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(59,130,246,0.8)]"
                />
              </div>
              <p className="text-xs font-mono text-slate-400 animate-pulse">
                {renderStage}
              </p>
            </div>
          </div>
        )}

        {/* Completed Download View */}
        {isComplete && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/60 text-emerald-200">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-emerald-100">
                  Video Render Complete!
                </h4>
                <p className="text-xs text-emerald-300/80 mt-0.5">
                  Your video has been rendered at {quality} ({fps} FPS).
                </p>
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
      </div>
    </div>
  );
}
