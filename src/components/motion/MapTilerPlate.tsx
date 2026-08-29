/**
 * MapTilerPlate — WebGL Vector Basemap Plate for MapExplainer
 * Implements Option B: MapTiler SDK Vector Maps (@maptiler/sdk + @turf/turf).
 * 
 * Follows Remotion Maps best practices:
 * - Initialize map ONCE (primitive dependency guards)
 * - Uses delayRender / continueRender until map is idle
 * - preserveDrawingBuffer: true for deterministic Chromium snapshots
 * - Turf.js lineSliceAlong for smooth, progressive route tracing
 * - Probes key health so restricted/invalid keys fall back to SVG projection instantly
 */

import React, { useEffect, useRef, useState } from "react";
import * as maptilersdk from "@maptiler/sdk";
import * as turf from "@turf/turf";
import { continueRender, delayRender, interpolate } from "remotion";

export interface MapTilerPlateProps {
  apiKey: string;
  origCoord: { name: string; lat: number; lng: number };
  destCoord: { name: string; lat: number; lng: number };
  mode?: "route" | "pin";
  themeColor?: string;
  frame: number;
  durationInFrames: number;
  children?: React.ReactNode;
}

// Global cache for key accessibility across frames and render workers
const probeCache: Record<string, boolean> = {};

export const MapTilerPlate: React.FC<MapTilerPlateProps> = ({
  apiKey,
  origCoord,
  destCoord,
  mode = "route",
  themeColor = "#38bdf8",
  frame,
  durationInFrames,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maptilersdk.Map | null>(null);
  const fullLineRef = useRef<any>(null);
  const isInitializedRef = useRef(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hasError, setHasError] = useState(probeCache[apiKey] === false);
  const [renderHandle] = useState(() => (probeCache[apiKey] === false ? null : delayRender("MapTiler Vector Basemap")));

  // Build curved great-circle / Bezier line coordinates using primitive coordinate numbers
  useEffect(() => {
    const origLng = origCoord.lng;
    const origLat = origCoord.lat;
    const destLng = destCoord.lng;
    const destLat = destCoord.lat;

    const midLng = (origLng + destLng) / 2;
    const midLat = (origLat + destLat) / 2 + Math.min(20, Math.abs(destLng - origLng) * 0.12);

    const points: [number, number][] = [];
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const lng = (1 - t) * (1 - t) * origLng + 2 * (1 - t) * t * midLng + t * t * destLng;
      const lat = (1 - t) * (1 - t) * origLat + 2 * (1 - t) * t * midLat + t * t * destLat;
      points.push([lng, lat]);
    }
    fullLineRef.current = turf.lineString(points);
  }, [origCoord.lng, origCoord.lat, destCoord.lng, destCoord.lat]);

  // Initialize MapTiler WebGL Map instance ONCE
  useEffect(() => {
    if (isInitializedRef.current || !containerRef.current || probeCache[apiKey] === false) return;
    isInitializedRef.current = true;

    let isCancelled = false;
    let handleContinued = false;

    const safeContinue = () => {
      if (!handleContinued) {
        handleContinued = true;
        if (renderHandle !== null) {
          continueRender(renderHandle);
        }
      }
    };

    const timer = setTimeout(safeContinue, 3500);

    async function initMap() {
      // 1. Probe key usability if not yet cached
      if (typeof probeCache[apiKey] !== "boolean") {
        if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
          probeCache[apiKey] = true;
        } else {
          try {
            const res = await fetch(`https://api.maptiler.com/maps/dataviz-v4-dark/style.json?key=${apiKey}`);
            probeCache[apiKey] = res.ok;
          } catch {
            probeCache[apiKey] = false;
          }
        }
      }

      if (!probeCache[apiKey]) {
        if (!isCancelled) {
          setHasError(true);
          clearTimeout(timer);
          safeContinue();
        }
        return;
      }

      // 2. Initialize WebGL map once
      maptilersdk.config.apiKey = apiKey;

      const origLng = origCoord.lng;
      const origLat = origCoord.lat;
      const destLng = destCoord.lng;
      const destLat = destCoord.lat;

      try {
        const map = new maptilersdk.Map({
          container: containerRef.current!,
          style: `https://api.maptiler.com/maps/dataviz-v4-dark/style.json?key=${apiKey}`,
          center: [origLng, origLat],
          zoom: mode === "pin" ? 6.5 : 3.0,
          preserveDrawingBuffer: true,
          interactive: false,
          attributionControl: false,
        });

        mapRef.current = map;

        map.on("load", () => {
          if (isCancelled) return;
          setMapLoaded(true);

          if (mode === "route" && fullLineRef.current) {
            map.addSource("route-source", {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: [],
              },
            });

            map.addLayer({
              id: "route-glow",
              type: "line",
              source: "route-source",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": themeColor,
                "line-width": 8,
                "line-blur": 4,
                "line-opacity": 0.5,
              },
            });

            map.addLayer({
              id: "route-line",
              type: "line",
              source: "route-source",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": themeColor,
                "line-width": 3.5,
              },
            });

            // Fit camera bounds across flight route with padding
            const bounds = new maptilersdk.LngLatBounds();
            bounds.extend([origLng, origLat]);
            bounds.extend([destLng, destLat]);
            map.fitBounds(bounds, { padding: 90, duration: 0 });
          }

          map.once("idle", () => {
            clearTimeout(timer);
            safeContinue();
          });

          map.on("error", () => {
            probeCache[apiKey] = false;
            setHasError(true);
            clearTimeout(timer);
            safeContinue();
            try {
              map.remove();
            } catch {}
            mapRef.current = null;
          });
        });
      } catch (err) {
        console.warn("[MapTilerPlate] WebGL initialization error:", err);
        probeCache[apiKey] = false;
        setHasError(true);
        clearTimeout(timer);
        safeContinue();
      }
    }

    initMap();

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      safeContinue();
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }
    };
  }, [apiKey, mode, themeColor, origCoord.lng, origCoord.lat, destCoord.lng, destCoord.lat]);

  // Imperatively update route line data per-frame without unmounting map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mode !== "route" || !fullLineRef.current || hasError) return;

    const map = mapRef.current;
    const source = map.getSource("route-source") as maptilersdk.GeoJSONSource | undefined;
    if (!source) return;

    const progress = interpolate(
      frame,
      [Math.floor(durationInFrames * 0.15), Math.floor(durationInFrames * 0.85)],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );

    const fullLine = fullLineRef.current;
    const totalKm = turf.length(fullLine, { units: "kilometers" });

    if (progress <= 0.005) {
      source.setData({ type: "FeatureCollection", features: [] });
    } else {
      const currentDist = Math.max(0.1, totalKm * progress);
      const sliced = turf.lineSliceAlong(fullLine, 0, currentDist, { units: "kilometers" });
      source.setData(sliced);
    }
  }, [frame, durationInFrames, mapLoaded, mode, hasError]);

  if (hasError || probeCache[apiKey] === false) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        ref={containerRef}
        data-testid="maptiler-canvas-container"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "#070b14",
          display: hasError ? "none" : "block",
        }}
      />
      {hasError && children}
    </>
  );
};
