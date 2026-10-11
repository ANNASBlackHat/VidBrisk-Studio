"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import useSWR from "swr";
import {
  Network,
  RotateCw,
  Layers,
  Sparkles,
  Info,
  Maximize2,
  ZoomIn,
  ZoomOut,
  X,
  Play,
  Clock,
  ExternalLink,
  Tag,
  Filter,
  Check,
  Activity,
  Flame,
} from "lucide-react";
import { api } from "@/lib/api";
import { MapDataResponse, MapPoint, MapCluster } from "@/lib/types";
import { FootageEntitiesModal } from "./FootageEntitiesModal";

type ColorMode = "cluster" | "provider" | "motion";

const PROVIDER_COLORS: Record<string, string> = {
  youtube: "#ef4444", // red-500
  pexels: "#10b981", // emerald-500
  pixabay: "#3b82f6", // blue-500
  shutterstock: "#f59e0b", // amber-500
  getty: "#8b5cf6", // purple-500
  default: "#94a3b8", // slate-400
};

const CLUSTER_PALETTE = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#eab308", // yellow
  "#10b981", // emerald
];

export function FootageMap() {
  const [selectedModel, setSelectedModel] = useState<string>("xclip-base-patch32");
  const [colorMode, setColorMode] = useState<ColorMode>("cluster");
  const [hoveredPoint, setHoveredPoint] = useState<MapPoint | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [isEntitiesModalOpen, setIsEntitiesModalOpen] = useState(false);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [recomputeResult, setRecomputeResult] = useState<string | null>(null);

  // Canvas ref & transform state (zoom & pan)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Fetch map data
  const { data: mapData, isLoading, mutate, error } = useSWR(
    ["footage-map", selectedModel],
    () => api.getFootageMap(selectedModel),
    { revalidateOnFocus: false }
  );

  // Fetch models list for selector
  const { data: modelsData } = useSWR(
    "footage-models",
    () => api.getFootageModels(),
    { revalidateOnFocus: false }
  );

  const points = useMemo(() => mapData?.points || [], [mapData]);
  const clusters = useMemo(() => mapData?.clusters || [], [mapData]);

  // Map cluster id to assigned color
  const clusterColorMap = useMemo(() => {
    const map = new Map<string, string>();
    clusters.forEach((c, idx) => {
      map.set(c.id, CLUSTER_PALETTE[idx % CLUSTER_PALETTE.length]);
    });
    return map;
  }, [clusters]);

  // Compute point color helper
  const getPointColor = useCallback(
    (point: MapPoint) => {
      if (colorMode === "cluster") {
        if (point.cluster_id && clusterColorMap.has(point.cluster_id)) {
          return clusterColorMap.get(point.cluster_id)!;
        }
        return "#64748b";
      }

      if (colorMode === "provider") {
        const prov = (point.provider || "").toLowerCase();
        return PROVIDER_COLORS[prov] || PROVIDER_COLORS.default;
      }

      if (colorMode === "motion") {
        // Motion score 0.0 -> 1.0 (interpolate cyan to orange/red)
        const motion = Math.min(Math.max(point.motion_score ?? 0, 0), 1);
        if (motion < 0.3) return "#06b6d4"; // Cyan (calm)
        if (motion < 0.6) return "#eab308"; // Yellow (medium)
        return "#ef4444"; // Red (high motion)
      }

      return "#6366f1";
    },
    [colorMode, clusterColorMap]
  );

  // Canvas Render Loop
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Background grid styling
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    const gridSize = 40 * zoom;
    const offsetX = (pan.x + width / 2) % gridSize;
    const offsetY = (pan.y + height / 2) % gridSize;

    for (let x = offsetX; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = offsetY; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // World transformation
    ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
    ctx.scale(zoom, zoom);

    // Map point coordinates: points typically range between [-1, 1] or similar
    // We scale them to fit canvas nicely (e.g., base scale 280px)
    const baseScale = Math.min(width, height) * 0.42;

    // Render cluster boundary hulls or faint circles if available
    clusters.forEach((cluster) => {
      const cx = cluster.centroid_x * baseScale;
      const cy = cluster.centroid_y * baseScale;
      const clusterColor = clusterColorMap.get(cluster.id) || "#6366f1";

      ctx.beginPath();
      ctx.arc(cx, cy, 32, 0, Math.PI * 2);
      ctx.fillStyle = `${clusterColor}15`;
      ctx.fill();
      ctx.strokeStyle = `${clusterColor}40`;
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Draw Points
    points.forEach((pt) => {
      const px = pt.x * baseScale;
      const py = pt.y * baseScale;
      const isHovered = hoveredPoint?.id === pt.id;
      const isSelected = selectedPoint?.id === pt.id;
      const pointColor = getPointColor(pt);

      ctx.beginPath();
      const radius = (isSelected ? 7 : isHovered ? 6 : 4) / Math.max(0.7, Math.sqrt(zoom));
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = pointColor;
      ctx.fill();

      if (isSelected || isHovered) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();
      }
    });

    // Draw Cluster Labels
    clusters.forEach((cluster) => {
      const cx = cluster.centroid_x * baseScale;
      const cy = cluster.centroid_y * baseScale;

      ctx.font = `600 ${Math.max(10, 11 / Math.sqrt(zoom))}px Inter, sans-serif`;
      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const labelText = `${cluster.label} (${cluster.size})`;
      const textWidth = ctx.measureText(labelText).width;

      // Label background pill
      const pillHeight = 18 / Math.max(0.8, Math.sqrt(zoom));
      const pillWidth = textWidth + 14 / Math.max(0.8, Math.sqrt(zoom));
      ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
      ctx.beginPath();
      ctx.roundRect(
        cx - pillWidth / 2,
        cy - pillHeight / 2,
        pillWidth,
        pillHeight,
        pillHeight / 2
      );
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1 / zoom;
      ctx.stroke();

      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(labelText, cx, cy);
    });

    ctx.restore();
  }, [points, clusters, zoom, pan, hoveredPoint, selectedPoint, getPointColor, clusterColorMap]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Find point near canvas client coords
  const findPointAtCoords = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const baseScale = Math.min(width, height) * 0.42;

      // Transform mouse to world coords
      const worldX = (mouseX - (width / 2 + pan.x)) / zoom;
      const worldY = (mouseY - (height / 2 + pan.y)) / zoom;

      const hitThreshold = 12 / zoom; // 12px hit radius in screen pixels

      for (let i = points.length - 1; i >= 0; i--) {
        const pt = points[i];
        const px = pt.x * baseScale;
        const py = pt.y * baseScale;
        const dist = Math.hypot(worldX - px, worldY - py);
        if (dist <= hitThreshold) {
          return pt;
        }
      }
      return null;
    },
    [points, pan, zoom]
  );

  // Mouse handlers for dragging/panning and hovering
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      setPan({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y,
      });
    } else {
      const pt = findPointAtCoords(e.clientX, e.clientY);
      setHoveredPoint(pt);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      // If drag delta is very small, treat as click
      const movedX = Math.abs(e.clientX - (dragStartRef.current.x + pan.x));
      const movedY = Math.abs(e.clientY - (dragStartRef.current.y + pan.y));
      if (movedX < 4 && movedY < 4) {
        const pt = findPointAtCoords(e.clientX, e.clientY);
        setSelectedPoint(pt);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((prev) => Math.min(Math.max(prev * factor, 0.3), 5));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleRecompute = async () => {
    setIsRecomputing(true);
    setRecomputeResult(null);
    try {
      const res = await api.recomputeFootageMap(selectedModel, 200);
      setRecomputeResult(`Successfully projected ${res.projected_points} points.`);
      await mutate();
    } catch (err: any) {
      setRecomputeResult(`Error: ${err.message || "Failed to recompute"}`);
    } finally {
      setIsRecomputing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3.5">
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Model Selector */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              {Array.isArray(modelsData) && modelsData.length > 0 ? (
                modelsData.map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                    {m.name} ({m.dims}d) {m.is_default ? "• Default" : ""}
                  </option>
                ))
              ) : (
                <>
                  <option value="xclip-base-patch32" className="bg-slate-900 text-white">
                    xclip-base-patch32 (512d) • Default
                  </option>
                  <option value="Qwen/Qwen3-VL-Embedding-2B" className="bg-slate-900 text-white">
                    Qwen3-VL-Embedding-2B (1536d)
                  </option>
                </>
              )}
            </select>
          </div>

          {/* Color Mode Selector */}
          <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setColorMode("cluster")}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                colorMode === "cluster"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Clusters
            </button>
            <button
              onClick={() => setColorMode("provider")}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                colorMode === "provider"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Provider
            </button>
            <button
              onClick={() => setColorMode("motion")}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                colorMode === "motion"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Motion
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEntitiesModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition-all shadow-sm"
          >
            <Tag className="w-3.5 h-3.5 text-indigo-400" />
            Manage Named Subjects
          </button>

          <button
            onClick={handleRecompute}
            disabled={isRecomputing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-sm"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRecomputing ? "animate-spin" : ""}`} />
            Recompute Projection
          </button>
        </div>
      </div>

      {recomputeResult && (
        <div className="flex items-center justify-between text-xs px-3.5 py-2 rounded-lg bg-indigo-950/40 border border-indigo-800/40 text-indigo-300">
          <span>{recomputeResult}</span>
          <button onClick={() => setRecomputeResult(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Canvas + Preview Drawer Container */}
      <div className="relative rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl h-[620px] flex">
        {/* Canvas Area */}
        <div className="flex-1 relative h-full">
          {isLoading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-sm gap-3">
              <RotateCw className="w-7 h-7 text-indigo-500 animate-spin" />
              <p className="text-xs text-slate-400 font-medium">Loading high-dimensional embeddings projection...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center">
              <Info className="w-8 h-8 text-amber-500 mb-2" />
              <p className="text-sm text-slate-200 font-medium">Could not load embedding map.</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Make sure the backend is active or trigger a recompute projection.
              </p>
            </div>
          )}

          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            className="w-full h-full cursor-grab active:cursor-grabbing block"
          />

          {/* Floating Canvas Controls */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-1 shadow-lg">
            <button
              onClick={() => setZoom((z) => Math.min(z * 1.2, 5))}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z * 0.8, 0.3))}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetView}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Reset View"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <div className="h-4 w-px bg-slate-800 mx-0.5" />
            <span className="text-[11px] font-mono text-slate-400 px-1.5">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Hover Tooltip Card */}
          {hoveredPoint && !selectedPoint && (
            <div
              className="absolute pointer-events-none z-20 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-lg p-2.5 shadow-2xl text-xs max-w-xs transition-opacity duration-150"
              style={{
                top: 20,
                left: 20,
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  {hoveredPoint.provider}
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {hoveredPoint.duration_sec.toFixed(1)}s
                </span>
                {hoveredPoint.cluster_label && (
                  <span className="text-slate-300 text-[11px] font-medium ml-auto">
                    {hoveredPoint.cluster_label}
                  </span>
                )}
              </div>
              <p className="text-white font-medium line-clamp-1">
                {hoveredPoint.title || "Video Shot #" + hoveredPoint.shot_id.slice(0, 8)}
              </p>
              {hoveredPoint.motion_score !== undefined && (
                <div className="flex items-center gap-1.5 mt-1.5 text-slate-400 text-[11px]">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Motion: {(hoveredPoint.motion_score * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          )}

          {/* Map Info Bar / Legend Overlay */}
          <div className="absolute top-4 right-4 z-10 hidden sm:flex items-center gap-3 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-400">
            <span>Points: <strong className="text-white">{points.length}</strong></span>
            <span>Clusters: <strong className="text-white">{clusters.length}</strong></span>
            <div className="h-3 w-px bg-slate-800" />
            <span className="text-[11px] text-slate-500">Drag to pan • Scroll to zoom</span>
          </div>
        </div>

        {/* Side Details Drawer (when a point is selected) */}
        {selectedPoint && (
          <div className="w-80 md:w-96 border-l border-slate-800 bg-slate-900/95 backdrop-blur-md flex flex-col z-30 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getPointColor(selectedPoint) }}
                />
                <h3 className="text-sm font-semibold text-white">Shot Details</h3>
              </div>
              <button
                onClick={() => setSelectedPoint(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Thumbnail or Video Player */}
              <div className="rounded-lg overflow-hidden bg-slate-950 border border-slate-800 aspect-video relative flex items-center justify-center">
                {selectedPoint.storage_url ? (
                  <video
                    src={selectedPoint.storage_url}
                    controls
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : selectedPoint.thumbnail_url ? (
                  <img
                    src={selectedPoint.thumbnail_url}
                    alt={selectedPoint.title || "Shot thumbnail"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center text-slate-600">
                    <Play className="w-6 h-6 mx-auto mb-1 opacity-50" />
                    <span>No Preview</span>
                  </div>
                )}
              </div>

              {/* Title & Metadata */}
              <div>
                <h4 className="text-white font-medium text-sm leading-snug">
                  {selectedPoint.title || "Untitled Shot"}
                </h4>
                <p className="text-[11px] text-slate-500 font-mono mt-1 break-all">
                  ID: {selectedPoint.shot_id}
                </p>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Provider</span>
                  <p className="text-slate-200 font-semibold capitalize mt-0.5">{selectedPoint.provider}</p>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Duration</span>
                  <p className="text-slate-200 font-semibold mt-0.5">{selectedPoint.duration_sec.toFixed(1)}s</p>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Orientation</span>
                  <p className="text-slate-200 font-semibold capitalize mt-0.5">{selectedPoint.orientation}</p>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Motion Score</span>
                  <p className="text-slate-200 font-semibold mt-0.5">
                    {selectedPoint.motion_score !== undefined
                      ? `${(selectedPoint.motion_score * 100).toFixed(0)}%`
                      : "N/A"}
                  </p>
                </div>
              </div>

              {/* Cluster Association */}
              {selectedPoint.cluster_label && (
                <div className="bg-indigo-950/20 border border-indigo-900/40 rounded-lg p-3">
                  <span className="text-[10px] text-indigo-400 uppercase font-bold tracking-wider">Assigned Cluster</span>
                  <p className="text-white font-medium text-xs mt-1">{selectedPoint.cluster_label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Located near centroid ({selectedPoint.x.toFixed(2)}, {selectedPoint.y.toFixed(2)})
                  </p>
                </div>
              )}

              {/* Action */}
              <div className="pt-2">
                <button
                  onClick={() => setIsEntitiesModalOpen(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all shadow-sm"
                >
                  <Tag className="w-3.5 h-3.5" />
                  Link to Named Entity
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Entities Modal */}
      {isEntitiesModalOpen && (
        <FootageEntitiesModal onClose={() => setIsEntitiesModalOpen(false)} />
      )}
    </div>
  );
}
