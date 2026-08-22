"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Player, PlayerRef } from "@remotion/player";
import {
  ArrowLeft,
  Film,
  Play,
  Pause,
  RotateCcw,
  Download,
  AlertCircle,
  Volume2,
  VolumeX,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  JobResponse,
  TimelineJSON,
} from "@/lib/types";
import {
  EditorProjectState,
  timelineToEditorState,
  getResolutionForOrientation,
} from "@/adapters/timelineToEditorState";
import { VideoComposition } from "@/components/editor/VideoComposition";
import { TimelineTracks } from "@/components/editor/TimelineTracks";
import { ClipInspector } from "@/components/editor/ClipInspector";
import { ExportModal } from "@/components/editor/ExportModal";

export default function VideoEditorPage() {
  const params = useParams();
  const jobId = params.id as string;

  const playerRef = useRef<PlayerRef>(null);

  // Fetch job state and compiled timeline JSON
  const { data: job, isLoading: jobLoading } = useSWR<JobResponse>(
    jobId ? `job-detail-${jobId}` : null,
    () => api.getJob(jobId)
  );

  const { data: timeline, isLoading: timelineLoading } = useSWR<TimelineJSON>(
    jobId ? `job-timeline-${jobId}` : null,
    () => api.getTimeline(jobId)
  );

  // Local live editable project state
  const [projectState, setProjectState] = useState<EditorProjectState | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [timelineZoom, setTimelineZoom] = useState<number>(1.0);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  // Initialize editor state once timeline loads
  useEffect(() => {
    if (timeline && job && !projectState) {
      const state = timelineToEditorState(timeline, job.target_orientation, job.id);
      setProjectState(state);
    }
  }, [timeline, job, projectState]);

  // Sync player frame with timeline playhead
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onFrameUpdate = () => {
      const frame = player.getCurrentFrame();
      const fps = projectState?.fps || 30;
      setCurrentTime(frame / fps);
      setIsPlaying(player.isPlaying());
    };

    player.addEventListener("timeupdate", onFrameUpdate);
    player.addEventListener("play", onFrameUpdate);
    player.addEventListener("pause", onFrameUpdate);

    return () => {
      player.removeEventListener("timeupdate", onFrameUpdate);
      player.removeEventListener("play", onFrameUpdate);
      player.removeEventListener("pause", onFrameUpdate);
    };
  }, [projectState?.fps]);

  // Sync mute state with Player
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (isMuted) {
      player.mute();
    } else {
      player.unmute();
    }
  }, [isMuted]);

  const handleSeek = (timeInSeconds: number) => {
    if (!playerRef.current || !projectState) return;
    const frame = Math.round(timeInSeconds * projectState.fps);
    playerRef.current.seekTo(frame);
    setCurrentTime(timeInSeconds);
  };

  const handleTogglePlay = () => {
    if (!playerRef.current) return;
    if (playerRef.current.isPlaying()) {
      playerRef.current.pause();
      setIsPlaying(false);
    } else {
      playerRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleUpdateClipProps = (
    clipId: string,
    newProps: Record<string, unknown>
  ) => {
    if (!projectState) return;

    const updatedTracks = projectState.tracks.map((track) => {
      if (track.id !== "video") return track;
      return {
        ...track,
        items: track.items.map((item) => {
          if (item.id !== clipId) return item;
          return {
            ...item,
            props: { ...item.props, ...newProps },
          };
        }),
      };
    });

    setProjectState({
      ...projectState,
      tracks: updatedTracks,
    });
  };

  const handleUpdateClipTiming = (
    clipId: string,
    sourceIn: number,
    sourceOut: number
  ) => {
    if (!projectState) return;

    const updatedTracks = projectState.tracks.map((track) => {
      if (track.id !== "video") return track;
      return {
        ...track,
        items: track.items.map((item) => {
          if (item.id !== clipId) return item;
          return {
            ...item,
            sourceIn,
            sourceOut,
          };
        }),
      };
    });

    setProjectState({
      ...projectState,
      tracks: updatedTracks,
    });
  };

  const handleSwapCandidate = (clipId: string, candidateIndex: number) => {
    if (!projectState) return;

    const updatedTracks = projectState.tracks.map((track) => {
      if (track.id !== "video") return track;
      return {
        ...track,
        items: track.items.map((item) => {
          if (item.id !== clipId || !item.candidates) return item;
          const candidate = item.candidates[candidateIndex];
          if (!candidate) return item;

          return {
            ...item,
            assetId: candidate.chunk_id,
            storagePath: candidate.storage_path,
            storageUrl: candidate.storage_url || candidate.storage_path,
            sourceIn: candidate.source_in,
            sourceOut: candidate.source_out,
          };
        }),
      };
    });

    setProjectState({
      ...projectState,
      tracks: updatedTracks,
    });
  };

  const handleDeleteClip = (clipId: string) => {
    if (!projectState) return;
    if (!confirm("Are you sure you want to remove this clip?")) return;

    const updatedTracks = projectState.tracks.map((track) => ({
      ...track,
      items: track.items.filter((i) => i.id !== clipId),
    }));

    setProjectState({
      ...projectState,
      tracks: updatedTracks,
      selectedClipId: null,
    });
  };

  if (jobLoading || timelineLoading || !projectState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400 font-mono">
          Loading Remotion Editor & Tracks...
        </p>
      </div>
    );
  }

  if (!timeline) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8 text-center bg-rose-950/20 border border-rose-900/40 rounded-2xl">
        <AlertCircle className="w-10 h-10 text-rose-400" />
        <h2 className="text-lg font-bold text-slate-100">Timeline Not Found</h2>
        <p className="text-xs text-slate-400 max-w-sm">
          Could not load compiled timeline for this job. Ensure the job reached Stage 7 (done).
        </p>
        <Link
          href={`/jobs/${jobId}`}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>View Job Progress</span>
        </Link>
      </div>
    );
  }

  // Find currently selected clip across tracks
  const selectedClip =
    projectState.tracks
      .flatMap((t) => t.items)
      .find((i) => i.id === projectState.selectedClipId) || null;

  const { width, height } = getResolutionForOrientation(projectState.orientation);
  const totalFrames = Math.max(1, Math.round(projectState.totalDuration * projectState.fps));

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] -mt-4 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Editor Header Bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href={`/jobs/${jobId}`}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
            title="Back to Job Summary"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-blue-400" />
              <span>Remotion Timeline Editor</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-blue-950 text-blue-400 border border-blue-800">
                {projectState.orientation} ({width}x{height})
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/25 active:scale-95 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export MP4</span>
          </button>
        </div>
      </div>

      {/* Main Studio Workspace */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left / Center Viewport: Remotion Player */}
        <div className="flex-1 min-h-0 min-w-0 flex flex-col items-center justify-center p-6 bg-slate-950/90 relative overflow-hidden">
          {/* Player Screen Box */}
          <div className="flex-1 w-full min-h-0 flex items-center justify-center">
            <div
              style={{
                aspectRatio: `${width}/${height}`,
              }}
              className="h-full max-h-full max-w-full w-auto rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-black flex items-center justify-center"
            >
              <Player
                ref={playerRef}
                component={VideoComposition}
                inputProps={{ projectState }}
                durationInFrames={totalFrames}
                fps={projectState.fps}
                compositionWidth={width}
                compositionHeight={height}
                style={{
                  width: "100%",
                  height: "100%",
                }}
                loop
                acknowledgeRemotionLicense
              />
            </div>
          </div>

          {/* Player Floating Control Toolbar */}
          <div className="flex items-center gap-3 mt-4 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-800/90 shadow-xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => handleSeek(0)}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-full hover:bg-slate-800 transition-colors"
              title="Restart from beginning"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleTogglePlay}
              className="p-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/30 transition-all active:scale-95"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-full hover:bg-slate-800 transition-colors"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>

            <div className="h-4 w-px bg-slate-800" />

            <div className="text-xs font-mono text-slate-400">
              <span className="text-blue-400 font-bold">
                {currentTime.toFixed(1)}s
              </span>{" "}
              / {projectState.totalDuration.toFixed(1)}s
            </div>
          </div>
        </div>

        {/* Right Sidebar: Clip Properties Inspector & Candidate Swapper */}
        <ClipInspector
          selectedClip={selectedClip}
          onUpdateClipProps={handleUpdateClipProps}
          onUpdateClipTiming={handleUpdateClipTiming}
          onSwapCandidate={handleSwapCandidate}
          onDeleteClip={handleDeleteClip}
        />
      </div>

      {/* Bottom Multi-Track Timeline */}
      <TimelineTracks
        projectState={projectState}
        currentTime={currentTime}
        onSeek={handleSeek}
        onSelectClip={(clipId) =>
          setProjectState({
            ...projectState,
            selectedClipId: clipId,
          })
        }
        onTrimClip={(clipId, start, end) => {
          // Trimming timeline clip start/end
          const updatedTracks = projectState.tracks.map((track) => ({
            ...track,
            items: track.items.map((item) => {
              if (item.id !== clipId) return item;
              return {
                ...item,
                trackStart: start,
                trackEnd: end,
                duration: end - start,
              };
            }),
          }));
          setProjectState({
            ...projectState,
            tracks: updatedTracks,
          });
        }}
        zoom={timelineZoom}
        onZoomChange={setTimelineZoom}
      />

      {/* Export MP4 Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        projectState={projectState}
      />
    </div>
  );
}
