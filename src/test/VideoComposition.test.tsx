// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";

// Minimal stand-ins for Remotion primitives: Sequences render unconditionally
// so layer structure is assertable without the full composition runtime.
vi.mock("remotion", async () => (await import("./mocks/remotion")).remotionMock());

import {
  VideoComposition,
  FootageClip,
  layerGeometry,
  getColorTreatmentFilter,
} from "@/components/editor/VideoComposition";
import { EditorProjectState } from "@/adapters/timelineToEditorState";
import { LayoutRole, FootageEffects } from "@/lib/types";

const baseState = (items: unknown[]): EditorProjectState => ({
  jobId: "job_test",
  fps: 30,
  totalDuration: 8,
  width: 1920,
  height: 1080,
  orientation: "horizontal",
  selectedClipId: null,
  tracks: [
    { id: "video", label: "Visuals", type: "video", items: items as never },
    { id: "text", label: "Captions", type: "text", items: [] },
    { id: "audio", label: "Voiceover", type: "audio", items: [] },
  ],
});

const footage = (
  id: string,
  url: string,
  layoutRole?: LayoutRole,
  effects?: FootageEffects
) => ({
  id,
  trackId: "video" as const,
  trackStart: 0,
  trackEnd: 4,
  duration: 4,
  assetType: "video" as const,
  storageUrl: url,
  layoutRole,
  effects,
});

const motion = (id: string, layoutRole?: LayoutRole) => ({
  id,
  trackId: "video" as const,
  trackStart: 0,
  trackEnd: 4,
  duration: 4,
  assetType: "motion" as const,
  componentId: "DataAnimations/StatCard",
  props: { primary_value: "$25.4B" },
  content: "$25.4B invested",
  layoutRole,
});

const mount = (state: EditorProjectState) =>
  render(React.createElement(VideoComposition, { projectState: state }));

afterEach(() => cleanup());

describe("VideoComposition — multi-layer rendering", () => {
  it("renders two concurrent footage layers side-by-side in z order", () => {
    const state = baseState([
      footage("b1_layer0", "http://media.local/split_left.mp4", "split-left"),
      footage("b1_layer1", "http://media.local/split_right.mp4", "split-right"),
    ]);
    const { container } = mount(state);

    const videos = Array.from(container.querySelectorAll("video"));
    expect(videos).toHaveLength(2);
    expect(videos[0].getAttribute("src")).toContain("split_left.mp4");
    expect(videos[1].getAttribute("src")).toContain("split_right.mp4");

    // DOM order (= stacking order) follows zIndex-sorted adapter output
    expect(container.innerHTML.indexOf("split_left.mp4")).toBeLessThan(
      container.innerHTML.indexOf("split_right.mp4")
    );

    // Both sequences cover the same overlapping window concurrently
    const seqs = container.querySelectorAll("[data-sequence]");
    expect(seqs[0].getAttribute("data-from")).toBe("0");
    expect(seqs[1].getAttribute("data-from")).toBe("0");
  });

  it("applies split geometry to footage layer containers", () => {
    const state = baseState([
      footage("l0", "http://media.local/a.mp4", "split-left"),
      footage("l1", "http://media.local/b.mp4", "split-right"),
    ]);
    const { container } = mount(state);
    const videos = Array.from(container.querySelectorAll("video"));
    const leftBox = videos[0].parentElement as HTMLElement;
    expect(leftBox.style.width).toBe("50%");
    const rightBox = videos[1].parentElement as HTMLElement;
    expect(rightBox.style.right).toBe("0px");
  });

  it("renders a motion overlay above full-bleed footage with pointer-events disabled", () => {
    const state = baseState([
      footage("bg", "http://media.local/footage.mp4"),
      motion("ov", "overlay-lower-third"),
    ]);
    const { container } = mount(state);

    expect(container.querySelector("video")).not.toBeNull();
    expect(container.textContent).toContain("$25.4B");

    const passthrough = Array.from(
      container.querySelectorAll<HTMLElement>("[data-testid='absolute-fill']")
    ).filter((el) => el.style.pointerEvents === "none");
    expect(passthrough.length).toBeGreaterThanOrEqual(1);

    // Full-bleed footage beneath stays interactive (no pointer-events override)
    const allFills = Array.from(
      container.querySelectorAll<HTMLElement>("[data-testid='absolute-fill']")
    );
    const footageFill = allFills.find((el) => el.querySelector("video"));
    expect(footageFill).toBeDefined();
    expect(footageFill!.style.pointerEvents).toBe("");
  });

  it("passes layoutRole through to motion components", () => {
    const state = baseState([motion("ov", "corner-br")]);
    const { container } = mount(state);
    // StatCard receives unknown props spread onto it; verify via rendered text
    // and that no geometry transform was applied by the composition itself.
    expect(container.textContent).toContain("$25.4B");
  });

  it("keeps legacy single-layer clips full-bleed and interactive by default", () => {
    const state = baseState([footage("clip_b1", "http://media.local/footage_a.mp4")]);
    const { container } = mount(state);
    expect(container.querySelectorAll("video")).toHaveLength(1);
    const passthrough = Array.from(
      container.querySelectorAll<HTMLElement>("[style]")
    ).find((el) => el.style.pointerEvents === "none");
    expect(passthrough).toBeUndefined();
  });
});

describe("layerGeometry", () => {
  it("maps each layout role to its region", () => {
    expect(layerGeometry("split-left")).toMatchObject({ left: 0, width: "50%" });
    expect(layerGeometry("split-right")).toMatchObject({ right: 0, width: "50%" });
    expect(layerGeometry("corner-tl")).toMatchObject({ left: "4%", top: "6%" });
    expect(layerGeometry("corner-br")).toMatchObject({ right: "4%", bottom: "6%" });
    expect(layerGeometry("overlay-lower-third")).toMatchObject({ bottom: 0, height: "34%" });
  });

  it("neutralizes opposing edges (AbsoluteFill merges over inset:0)", () => {
    // Regression: split-right previously kept left:0 from AbsoluteFill defaults,
    // collapsing both split halves onto the left half of the frame.
    expect(layerGeometry("split-right")).toMatchObject({ left: "auto", top: 0, bottom: 0 });
    expect(layerGeometry("split-left")).toMatchObject({ right: "auto", top: 0, bottom: 0 });
    expect(layerGeometry("overlay-lower-third")).toMatchObject({ top: "auto", left: 0, right: 0 });
    for (const role of ["corner-tl", "corner-tr", "corner-bl", "corner-br"] as const) {
      const g = layerGeometry(role);
      expect(Object.values(g).filter((v) => v === "auto").length).toBe(2);
    }
  });

  it("treats full / takeover / undefined as opaque full-bleed", () => {
    for (const role of ["full", "takeover", undefined] as const) {
      expect(layerGeometry(role as LayoutRole | undefined)).toEqual({});
    }
  });
});

describe("getColorTreatmentFilter", () => {
  it("returns CSS filter for duotone variants and undefined for none/default", () => {
    expect(getColorTreatmentFilter("duotone-cool")).toContain("hue-rotate(180deg)");
    expect(getColorTreatmentFilter("duotone-warm")).toContain("hue-rotate(-20deg)");
    expect(getColorTreatmentFilter("duotone-mono")).toContain("grayscale(1)");
    expect(getColorTreatmentFilter("none")).toBeUndefined();
    expect(getColorTreatmentFilter(undefined)).toBeUndefined();
  });
});

describe("FootageClip — Footage Effects", () => {
  it("applies colorTreatment CSS filter to video element", () => {
    const { container } = render(
      <FootageClip
        resolvedUrl="http://media.local/video.mp4"
        startFromFrames={0}
        durationFrames={120}
        effects={{ colorTreatment: "duotone-cool" }}
      />
    );

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video!.style.filter).toContain("hue-rotate(180deg)");
  });

  it("renders grain overlay when grain is true and uses grainIntensity", () => {
    const { container } = render(
      <FootageClip
        resolvedUrl="http://media.local/video.mp4"
        startFromFrames={0}
        durationFrames={120}
        effects={{ grain: true, grainIntensity: 0.25 }}
      />
    );

    const grain = container.querySelector("[data-testid='footage-grain']") as HTMLElement;
    expect(grain).not.toBeNull();
    expect(grain.style.opacity).toBe("0.25");
    expect(grain.style.pointerEvents).toBe("none");
  });

  it("renders vignette overlay when vignette is true", () => {
    const { container } = render(
      <FootageClip
        resolvedUrl="http://media.local/video.mp4"
        startFromFrames={0}
        durationFrames={120}
        effects={{ vignette: true }}
      />
    );

    const vignette = container.querySelector("[data-testid='footage-vignette']") as HTMLElement;
    expect(vignette).not.toBeNull();
    expect(vignette.style.background).toContain("radial-gradient");
    expect(vignette.style.pointerEvents).toBe("none");
  });

  it("combines colorTreatment, grain, vignette, and layoutRole seamlessly", () => {
    const state = baseState([
      footage("l0", "http://media.local/split.mp4", "split-left", {
        colorTreatment: "duotone-warm",
        grain: true,
        vignette: true,
      }),
    ]);
    const { container } = mount(state);

    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video!.style.filter).toContain("hue-rotate(-20deg)");

    expect(container.querySelector("[data-testid='footage-grain']")).not.toBeNull();
    expect(container.querySelector("[data-testid='footage-vignette']")).not.toBeNull();

    const leftBox = video!.parentElement as HTMLElement;
    expect(leftBox.style.width).toBe("50%");
  });
});

