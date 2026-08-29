// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";

vi.mock("remotion", async () => (await import("./mocks/remotion")).remotionMock());

// Mock @maptiler/sdk for jsdom environment
vi.mock("@maptiler/sdk", () => ({
  config: { apiKey: "" },
  MapStyle: { DATAVIZ: { DARK: "dataviz-dark" } },
  LngLatBounds: vi.fn().mockImplementation(function () {
    return {
      extend: vi.fn(),
    };
  }),
  Map: vi.fn().mockImplementation(function () {
    return {
      on: vi.fn((event, cb) => {
        if (event === "load") cb();
      }),
      once: vi.fn((event, cb) => {
        if (event === "idle") cb();
      }),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      getSource: vi.fn().mockReturnValue({ setData: vi.fn() }),
      fitBounds: vi.fn(),
      remove: vi.fn(),
    };
  }),
}));

import { MapExplainer, MAP_EXPLAINER_SUPPORTED_ROLES } from "@/components/motion/MapExplainer";
import { getMotionComponent, MOTION_COMPONENTS } from "@/components/motion/registry";

afterEach(() => {
  cleanup();
});

describe("Registry Resolution — MapExplainer", () => {
  it("registers GeoAnimations/MapExplainer in MOTION_COMPONENTS", () => {
    expect(MOTION_COMPONENTS["GeoAnimations/MapExplainer"]).toBeDefined();
    expect(MOTION_COMPONENTS["GeoAnimations/MapExplainer"]).toBe(MapExplainer);
  });

  it("resolves exact and case-insensitive matches", () => {
    expect(getMotionComponent("GeoAnimations/MapExplainer")).toBe(MapExplainer);
    expect(getMotionComponent("geoanimations/mapexplainer")).toBe(MapExplainer);
    expect(getMotionComponent("MapExplainer")).toBe(MapExplainer);
  });

  it("exports supported layout roles conforming to contract", () => {
    expect(MAP_EXPLAINER_SUPPORTED_ROLES).toContain("takeover");
    expect(MAP_EXPLAINER_SUPPORTED_ROLES).toContain("full");
    expect(MAP_EXPLAINER_SUPPORTED_ROLES).toContain("overlay-lower-third");
    expect(MAP_EXPLAINER_SUPPORTED_ROLES).toContain("corner-tr");
  });
});

describe("MapExplainer Component — SVG Fallback Mode", () => {
  it("renders Route Mode with SVG canvas when apiKey is absent", () => {
    const { container } = render(
      <MapExplainer
        origin="Cape Canaveral"
        destination="Pacific Ocean"
        title="APOLLO 11 TRAJECTORY"
        mode="route"
        durationInFrames={180}
        layoutRole="takeover"
      />
    );

    expect(container.textContent).toContain("APOLLO 11 TRAJECTORY");
    expect(container.textContent).toContain("CAPE CANAVERAL");
    expect(container.textContent).toContain("PACIFIC OCEAN");

    const svg = container.querySelector('[data-testid="svg-map-canvas"]');
    expect(svg).not.toBeNull();
  });

  it("renders Pin Mode for a single location coordinate", () => {
    const { container } = render(
      <MapExplainer
        origin={{ name: "Houston Mission Control", lat: 29.76, lng: -95.36 }}
        mode="pin"
        durationInFrames={120}
        layoutRole="overlay-lower-third"
      />
    );

    expect(container.textContent).toContain("HOUSTON MISSION CONTROL");
    expect(container.textContent).toContain("COORDINATE LOCK");
    expect(container.textContent).toContain("LAT: 29.76°");
    expect(container.textContent).toContain("LNG: -95.36°");
  });

  it("applies transparent styling for overlay roles", () => {
    const { container } = render(
      <MapExplainer
        origin="London"
        mode="pin"
        durationInFrames={90}
        layoutRole="corner-tr"
      />
    );

    const rootFill = container.firstElementChild as HTMLElement;
    expect(rootFill.style.backgroundColor).toBe("transparent");
    expect(rootFill.style.pointerEvents).toBe("none");
  });
});

describe("MapExplainer Component — Option B MapTiler SDK Mode", () => {
  it("renders MapTilerPlate when apiKey is explicitly provided", () => {
    const { container } = render(
      <MapExplainer
        origin="Cape Canaveral"
        destination="Pacific Ocean"
        apiKey="test_maptiler_key"
        mode="route"
        durationInFrames={120}
        layoutRole="takeover"
      />
    );

    const maptilerContainer = container.querySelector('[data-testid="maptiler-canvas-container"]');
    expect(maptilerContainer).not.toBeNull();

    const svgFallback = container.querySelector('[data-testid="svg-map-canvas"]');
    expect(svgFallback).toBeNull();
  });
});
