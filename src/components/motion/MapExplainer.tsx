/**
 * MapExplainer — Geographic Route & Location Pin Animation Component
 * Implements SPEC_colab_rendering_export & plan_advanced_remotion_capabilities.
 * 
 * Uses deterministic SVG vector projection with dynamic Bezier route tracing,
 * pulsating location radar pins, and camera pan/zoom tracking.
 * 
 * // TODO: Add support for Option B (MapTiler/Mapbox vector tiles via @maptiler/sdk and REMOTION_MAPTILER_KEY)
 */

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { LayoutRole } from "@/lib/types";
import { resolveDisplay, displayContainerStyle } from "./layoutContract";
import { MapPin, Navigation, Compass } from "lucide-react";
import { MapTilerPlate } from "./MapTilerPlate";

export const MAP_EXPLAINER_SUPPORTED_ROLES: LayoutRole[] = [
  "takeover",
  "full",
  "overlay-lower-third",
  "corner-tl",
  "corner-tr",
  "corner-bl",
  "corner-br",
  "split-left",
  "split-right",
];

export interface GeoLocation {
  name: string;
  lat?: number;
  lng?: number;
}

export interface MapExplainerProps extends Record<string, unknown> {
  origin?: GeoLocation | string;
  destination?: GeoLocation | string;
  title?: string;
  subtext?: string;
  mode?: "route" | "pin";
  themeColor?: string;
  durationInFrames?: number;
  layoutRole?: LayoutRole;
  apiKey?: string;
}

// Built-in coordinate gazetteer for common historical & modern locations
const KNOWN_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  "cape canaveral": { lat: 28.3922, lng: -80.6077 },
  "houston": { lat: 29.7604, lng: -95.3698 },
  "new york": { lat: 40.7128, lng: -74.006 },
  "washington dc": { lat: 38.9072, lng: -77.0369 },
  "london": { lat: 51.5074, lng: -0.1278 },
  "paris": { lat: 48.8566, lng: 2.3522 },
  "berlin": { lat: 52.52, lng: 13.405 },
  "moscow": { lat: 55.7558, lng: 37.6173 },
  "baikonur": { lat: 45.9646, lng: 63.3052 },
  "tokyo": { lat: 35.6762, lng: 139.6503 },
  "beijing": { lat: 39.9042, lng: 116.4074 },
  "sydney": { lat: -33.8688, lng: 151.2093 },
  "cairo": { lat: 30.0444, lng: 31.2357 },
  "pacific ocean": { lat: 0.0, lng: -160.0 },
  "atlantic ocean": { lat: 25.0, lng: -40.0 },
  "lunar orbit": { lat: 10.0, lng: -45.0 },
};

function resolveCoords(loc?: GeoLocation | string): { name: string; lat: number; lng: number } {
  if (!loc) return { name: "Cape Canaveral", lat: 28.3922, lng: -80.6077 };
  if (typeof loc === "string") {
    const key = loc.toLowerCase().trim();
    const found = KNOWN_LOCATIONS[key] || { lat: 35.0, lng: -40.0 };
    return { name: loc, ...found };
  }
  const key = loc.name.toLowerCase().trim();
  const found = KNOWN_LOCATIONS[key];
  return {
    name: loc.name,
    lat: loc.lat ?? found?.lat ?? 30.0,
    lng: loc.lng ?? found?.lng ?? -40.0,
  };
}

// Equirectangular projection mapping (lat/lng -> viewBox 0..1000, 0..500)
function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * 1000;
  const y = ((90 - lat) / 180) * 500;
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

// Simplified continent vector paths for dark aesthetic cartography
const CONTINENTS_PATH =
  "M 150 110 L 220 80 L 280 120 L 260 180 L 190 200 L 140 160 Z " + // North America
  "M 260 230 L 320 240 L 340 330 L 290 420 L 250 340 L 240 270 Z " + // South America
  "M 470 90 L 540 80 L 580 130 L 520 160 L 460 130 Z " + // Europe
  "M 470 180 L 570 190 L 590 310 L 530 390 L 460 310 L 440 210 Z " + // Africa
  "M 600 70 L 780 80 L 860 160 L 770 260 L 640 220 L 590 140 Z " + // Asia
  "M 790 310 L 890 320 L 880 390 L 810 390 Z"; // Australia

export const MapExplainer: React.FC<MapExplainerProps> = ({
  origin: rawOrigin = "Cape Canaveral",
  destination: rawDestination = "Pacific Ocean",
  title,
  subtext,
  mode = "route",
  themeColor = "#38bdf8",
  durationInFrames: propDuration,
  layoutRole,
  apiKey,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: videoDuration } = useVideoConfig();
  const duration = propDuration || videoDuration || 180;

  const display = resolveDisplay({ layoutRole });
  const isOverlay = display === "overlay";

  const origin = resolveCoords(rawOrigin);
  const destination = resolveCoords(rawDestination);

  const p1 = project(origin.lat, origin.lng);
  const p2 = project(destination.lat, destination.lng);

  // Entrance spring animation
  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  // Calculate arc control point for curved flight path
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2 - Math.min(80, Math.abs(p2.x - p1.x) * 0.25);
  const routePathD = `M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`;

  // Route drawing progress (0 -> 1)
  const drawProgress = interpolate(frame, [15, duration - 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Camera pan & zoom: smooth focus between origin and midpoint/destination
  const targetFocusX = mode === "pin" ? p1.x : interpolate(drawProgress, [0, 1], [p1.x, midX]);
  const targetFocusY = mode === "pin" ? p1.y : interpolate(drawProgress, [0, 1], [p1.y, midY]);

  // Current vehicle/marker position along the Bezier curve
  const t = drawProgress;
  const curX = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * midX + t * t * p2.x;
  const curY = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * midY + t * t * p2.y;

  // Radar ping pulse (continuous subtle oscillation)
  const pingScale = interpolate((frame % 45) / 45, [0, 1], [1, 2.5]);
  const pingOpacity = interpolate((frame % 45) / 45, [0, 0.8, 1], [0.8, 0.2, 0]);

  // Header Title fallback
  const displayTitle = title || (mode === "route" ? `${origin.name} → ${destination.name}` : origin.name);
  const displaySubtext = subtext || (mode === "route" ? "TRAJECTORY FLIGHT PATH" : "COORDINATE LOCK");

  const effectiveApiKey =
    apiKey ||
    (typeof process !== "undefined" && process.env?.REMOTION_MAPTILER_KEY) ||
    undefined;

  const svgCanvas = (
    <svg
      data-testid="svg-map-canvas"
      viewBox={`${Math.max(0, targetFocusX - 250)} ${Math.max(0, targetFocusY - 150)} 500 300`}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "#060911",
      }}
    >
      {/* Latitude / Longitude coordinate grid */}
      <defs>
        <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.75" />
        </pattern>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="1000" height="500" fill="url(#grid)" />

      {/* Continents Base Geography */}
      <path
        d={CONTINENTS_PATH}
        fill="rgba(30, 41, 59, 0.6)"
        stroke="rgba(71, 85, 105, 0.4)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Route Mode: Trajectory Curve */}
      {mode === "route" && (
        <>
          {/* Background Guide Trace */}
          <path
            d={routePathD}
            fill="none"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="2"
            strokeDasharray="4 4"
          />

          {/* Animated Glowing Active Arc */}
          <path
            d={routePathD}
            fill="none"
            stroke={themeColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            filter="url(#glow)"
            style={{
              strokeDasharray: 600,
              strokeDashoffset: 600 * (1 - drawProgress),
            }}
          />

          {/* Active Flight Tracker Marker */}
          {drawProgress > 0 && drawProgress < 1 && (
            <g transform={`translate(${curX}, ${curY})`}>
              <circle r="6" fill={themeColor} filter="url(#glow)" />
              <circle r="12" fill="none" stroke={themeColor} strokeWidth="1.5" opacity="0.6" />
            </g>
          )}
        </>
      )}

      {/* Origin Radar Pin */}
      <g transform={`translate(${p1.x}, ${p1.y})`}>
        <circle r="14" fill={themeColor} opacity={pingOpacity} transform={`scale(${pingScale})`} />
        <circle r="5" fill={themeColor} filter="url(#glow)" />
        <text
          x="12"
          y="4"
          fill="#f8fafc"
          fontSize="12"
          fontFamily="monospace"
          fontWeight="bold"
          style={{ textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}
        >
          {origin.name.toUpperCase()}
        </text>
      </g>

      {/* Destination Pin (for route mode) */}
      {mode === "route" && (
        <g transform={`translate(${p2.x}, ${p2.y})`}>
          {drawProgress > 0.8 && (
            <circle r="14" fill="#a855f7" opacity={pingOpacity} transform={`scale(${pingScale})`} />
          )}
          <circle r="5" fill="#a855f7" filter="url(#glow)" />
          <text
            x="12"
            y="4"
            fill="#f8fafc"
            fontSize="12"
            fontFamily="monospace"
            fontWeight="bold"
            style={{ textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}
          >
            {destination.name.toUpperCase()}
          </text>
        </g>
      )}
    </svg>
  );

  return (
    <AbsoluteFill
      style={{
        ...displayContainerStyle(display),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isOverlay ? "1.5rem" : "3rem",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: isOverlay ? "1.25rem" : "2rem",
          overflow: "hidden",
          backgroundColor: isOverlay ? "rgba(15, 23, 42, 0.85)" : "#090d16",
          border: `1px solid ${isOverlay ? "rgba(56, 189, 248, 0.3)" : "#1e293b"}`,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
          backdropFilter: isOverlay ? "blur(12px)" : "none",
          transform: `scale(${enterSpring})`,
          opacity: enterSpring,
        }}
      >
        {/* Vector Basemap: Option B (MapTiler WebGL) or Option A (SVG Fallback) */}
        {effectiveApiKey ? (
          <MapTilerPlate
            apiKey={effectiveApiKey}
            origCoord={origin}
            destCoord={destination}
            mode={mode}
            themeColor={themeColor}
            frame={frame}
            durationInFrames={duration}
          >
            {svgCanvas}
          </MapTilerPlate>
        ) : (
          svgCanvas
        )}

        {/* Tactical UI Card Overlay */}
        <div
          style={{
            position: "absolute",
            top: isOverlay ? "1rem" : "1.75rem",
            left: isOverlay ? "1rem" : "1.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            padding: "0.75rem 1.25rem",
            borderRadius: "1rem",
            border: "1px solid rgba(56, 189, 248, 0.2)",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Compass style={{ width: 14, height: 14, color: themeColor }} />
            <span
              style={{
                fontSize: "0.65rem",
                fontFamily: "monospace",
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: themeColor,
                textTransform: "uppercase",
              }}
            >
              {displaySubtext}
            </span>
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: isOverlay ? "1rem" : "1.35rem",
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.02em",
            }}
          >
            {displayTitle}
          </h2>

          {/* Coordinates Telemetry */}
          <div
            style={{
              fontSize: "0.65rem",
              fontFamily: "monospace",
              color: "#94a3b8",
              display: "flex",
              gap: "0.75rem",
              marginTop: "0.15rem",
            }}
          >
            <span>LAT: {origin.lat.toFixed(2)}°</span>
            <span>LNG: {origin.lng.toFixed(2)}°</span>
            {mode === "route" && (
              <span style={{ color: "#38bdf8" }}>PROGRESS: {Math.round(drawProgress * 100)}%</span>
            )}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
