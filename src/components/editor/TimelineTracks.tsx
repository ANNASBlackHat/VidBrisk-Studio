"use client";

import React, { useRef } from "react";
import {
  EditorProjectState,
  EditorClip,
} from "@/adapters/timelineToEditorState";
import {
  Film,
  Type,
  Mic,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { formatDuration } from "@/lib/utils";

interface TimelineTracksProps {
  projectState: EditorProjectState;
  currentTime: number; // in seconds
  onSeek: (timeInSeconds: number) => void;
  onSelectClip: (clipId: string) => void;
  onTrimClip: (clipId: string, newStart: number, newEnd: number) => void;
  zoom: number; // scale multiplier e.g. 1.0 to 3.0
  onZoomChange: (zoom: number) => void;
}

export function TimelineTracks({
  projectState,
  currentTime,
  onSeek,
  onSelectClip,
  zoom,
  onZoomChange,
}: TimelineTracksProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const totalDuration = Math.max(1, projectState.totalDuration);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(percentage * totalDuration);
  };

  const playheadPercent = Math.min(100, Math.max(0, (currentTime / totalDuration) * 100));

  const getTrackIcon = (type: string) => {
    switch (type) {
      case "text":
        return <Type className="w-3.5 h-3.5 text-cyan-400" />;
      case "audio":
        return <Mic className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Film className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  const getClipStyle = (clip: EditorClip, isSelected: boolean) => {
    const left = `${(clip.trackStart / totalDuration) * 100}%`;
    const width = `${Math.max(1, (clip.duration / totalDuration) * 100)}%`;

    let bgColor = "bg-blue-600/70 border-blue-400/80 text-blue-100";
    if (clip.assetType === "motion") {
      bgColor = "bg-purple-600/70 border-purple-400/80 text-purple-100";
    } else if (clip.trackId === "text") {
      bgColor = "bg-cyan-600/60 border-cyan-400/70 text-cyan-100";
    } else if (clip.trackId === "audio") {
      bgColor = "bg-amber-600/60 border-amber-400/70 text-amber-100";
    }

    return {
      left,
      width,
      className: `absolute top-1 bottom-1 rounded-lg border px-2 py-1 text-xs font-mono flex items-center justify-between overflow-hidden cursor-pointer transition-all ${bgColor} ${
        isSelected
          ? "ring-2 ring-white ring-offset-2 ring-offset-slate-950 shadow-lg"
          : "hover:brightness-110"
      }`,
    };
  };

  // Generate time markers across the timeline (every 2 or 5 seconds)
  const markerStep = totalDuration > 30 ? 5 : 2;
  const markerCount = Math.ceil(totalDuration / markerStep);
  const timeMarkers = Array.from({ length: markerCount + 1 }, (_, i) => i * markerStep);

  return (
    <div className="flex flex-col bg-slate-950 border-t border-slate-800 select-none">
      {/* Timeline Controls & Zoom Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 bg-slate-900/40 text-xs">
        <div className="flex items-center gap-3 font-mono">
          <span className="text-blue-400 font-bold">
            {formatDuration(currentTime)}
          </span>
          <span className="text-slate-500">/</span>
          <span className="text-slate-400">
            {formatDuration(totalDuration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-mono">Zoom:</span>
          <button
            type="button"
            onClick={() => onZoomChange(Math.max(1.0, zoom - 0.25))}
            disabled={zoom <= 1.0}
            className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] text-slate-300 w-8 text-center">
            {zoom.toFixed(1)}x
          </span>
          <button
            type="button"
            onClick={() => onZoomChange(Math.min(3.0, zoom + 0.25))}
            disabled={zoom >= 3.0}
            className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tracks Container */}
      <div className="flex overflow-x-auto">
        {/* Track Headers (Left column) */}
        <div className="w-44 shrink-0 border-r border-slate-800 bg-slate-900/60 z-20">
          {/* Time ruler header placeholder */}
          <div className="h-7 border-b border-slate-800 flex items-center px-3 text-[10px] uppercase font-mono text-slate-500">
            Tracks
          </div>

          {projectState.tracks.map((track) => (
            <div
              key={track.id}
              className="h-14 border-b border-slate-800/80 px-3 flex items-center gap-2 text-xs font-semibold text-slate-300"
            >
              {getTrackIcon(track.type)}
              <span className="truncate">{track.label}</span>
            </div>
          ))}
        </div>

        {/* Scrollable Tracks Canvas (Right column) */}
        <div
          ref={timelineRef}
          onClick={handleTimelineClick}
          style={{ width: `${zoom * 100}%`, minWidth: "100%" }}
          className="relative flex-1 bg-slate-950 cursor-pointer overflow-hidden"
        >
          {/* Top Time Ruler */}
          <div className="h-7 border-b border-slate-800 bg-slate-900/30 relative">
            {timeMarkers.map((timeSec) => {
              const leftPercent = (timeSec / totalDuration) * 100;
              if (leftPercent > 100) return null;
              return (
                <div
                  key={timeSec}
                  style={{ left: `${leftPercent}%` }}
                  className="absolute top-0 bottom-0 flex flex-col items-start"
                >
                  <div className="h-2 w-px bg-slate-700" />
                  <span className="text-[9px] font-mono text-slate-500 -ml-2.5 mt-0.5">
                    {timeSec}s
                  </span>
                </div>
              );
            })}
          </div>

          {/* Draggable Playhead Needle */}
          <div
            style={{ left: `${playheadPercent}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.8)]"
          >
            <div className="w-3 h-3 bg-red-500 rounded-full -ml-[5px] -mt-1 shadow-md border border-white" />
          </div>

          {/* Track Lanes */}
          {projectState.tracks.map((track) => (
            <div
              key={track.id}
              className="h-14 border-b border-slate-800/60 relative bg-slate-950/40"
            >
              {track.items.map((clip) => {
                const isSelected = projectState.selectedClipId === clip.id;
                const { left, width, className } = getClipStyle(clip, isSelected);

                return (
                  <div
                    key={clip.id}
                    style={{ left, width }}
                    className={className}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClip(clip.id);
                    }}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {clip.assetType === "motion" && (
                        <Sparkles className="w-3 h-3 text-purple-300 shrink-0" />
                      )}
                      <span className="truncate font-semibold text-[11px]">
                        {clip.assetType === "motion"
                          ? clip.componentId?.split("/")[1] || "Motion Card"
                          : clip.content || clip.id}
                      </span>
                    </div>

                    <span className="text-[10px] opacity-75 shrink-0 ml-1">
                      {clip.duration.toFixed(1)}s
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
