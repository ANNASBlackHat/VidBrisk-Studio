// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import {
  groupOverlappingClips,
  sortByZIndex,
} from "@/components/editor/TimelineTracks";

const clip = (
  id: string,
  trackStart: number,
  trackEnd: number,
  extra: Record<string, unknown> = {}
) => ({
  id,
  trackId: "video" as const,
  trackStart,
  trackEnd,
  duration: trackEnd - trackStart,
  ...extra,
});

afterEach(() => cleanup());

describe("groupOverlappingClips", () => {
  it("merges overlapping clips into one stack", () => {
    const stacks = groupOverlappingClips([
      clip("a", 0, 4),
      clip("b", 2, 6),
    ]);
    expect(stacks).toHaveLength(1);
    expect(stacks[0].map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("keeps disjoint clips in separate stacks", () => {
    const stacks = groupOverlappingClips([
      clip("a", 0, 4),
      clip("b", 4, 8),
    ]);
    expect(stacks).toHaveLength(2);
  });

  it("treats sub-frame touch as non-overlapping", () => {
    const stacks = groupOverlappingClips([
      clip("a", 0, 4),
      clip("b", 3.98, 8),
    ]);
    expect(stacks).toHaveLength(2);
  });

  it("merges a chain A–B–C even when A and C do not directly overlap", () => {
    const stacks = groupOverlappingClips([
      clip("a", 0, 2),
      clip("b", 1.5, 3.5),
      clip("c", 3, 5),
    ]);
    expect(stacks).toHaveLength(1);
    expect(stacks[0]).toHaveLength(3);
  });
});

describe("sortByZIndex", () => {
  it("orders by zIndex with untagged clips last, stable within ties", () => {
    const sorted = sortByZIndex([
      clip("untagged", 0, 1),
      clip("z2", 0, 1, { zIndex: 2 }),
      clip("z0", 0, 1, { zIndex: 0 }),
      clip("untagged2", 0, 1),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(["z0", "z2", "untagged", "untagged2"]);
  });
});

// --- Component-level tests -------------------------------------------------

vi.mock("remotion", async () => (await import("./mocks/remotion")).remotionMock());

import { TimelineTracks } from "@/components/editor/TimelineTracks";
import { EditorProjectState } from "@/adapters/timelineToEditorState";

const makeState = (items: unknown[], selectedClipId: string | null = null) =>
  ({
    jobId: "job",
    fps: 30,
    totalDuration: 8,
    width: 1920,
    height: 1080,
    orientation: "horizontal",
    selectedClipId,
    tracks: [
      { id: "video", label: "Visuals", type: "video", items },
      { id: "text", label: "Captions", type: "text", items: [] },
      { id: "audio", label: "Voiceover", type: "audio", items: [] },
    ],
  } as EditorProjectState);

const layeredItems = [
  clip("b1_layer0", 0, 4, { assetType: "video", layoutRole: "split-left", zIndex: 0 }),
  clip("b1_layer1", 0, 4, { assetType: "video", layoutRole: "split-right", zIndex: 1 }),
];

describe("TimelineTracks — stack badges", () => {
  it("shows a +N layers badge for overlapping clips only in the video lane", () => {
    const state = makeState(layeredItems);
    const { container } = render(
      React.createElement(TimelineTracks, {
        projectState: state,
        currentTime: 0,
        onSeek: vi.fn(),
        onSelectClip: vi.fn(),
        onTrimClip: vi.fn(),
        zoom: 1,
        onZoomChange: vi.fn(),
      })
    );
    const badge = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("+1")
    );
    expect(badge).toBeDefined();
  });

  it("renders no badge for non-overlapping timelines (legacy regression)", () => {
    const state = makeState([
      clip("a", 0, 4, { assetType: "video" }),
      clip("b", 4, 8, { assetType: "video" }),
    ]);
    const { container } = render(
      React.createElement(TimelineTracks, {
        projectState: state,
        currentTime: 0,
        onSeek: vi.fn(),
        onSelectClip: vi.fn(),
        onTrimClip: vi.fn(),
        zoom: 1,
        onZoomChange: vi.fn(),
      })
    );
    const badge = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.match(/\+\d/)
    );
    expect(badge).toBeUndefined();
  });

  it("expands to a z-ordered layer picker and selects layers via callback", () => {
    const onSelectClip = vi.fn();
    const state = makeState(layeredItems, "b1_layer1");
    const { container } = render(
      React.createElement(TimelineTracks, {
        projectState: state,
        currentTime: 0,
        onSeek: vi.fn(),
        onSelectClip,
        onTrimClip: vi.fn(),
        zoom: 1,
        onZoomChange: vi.fn(),
      })
    );

    // Picker hidden before expanding
    expect(container.textContent).not.toContain("Layer Stack");

    const badge = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("+1")
    )!;
    fireEvent.click(badge);

    expect(container.textContent).toContain("Layer Stack");
    // z-order: split-left (z0) listed before split-right (z1)
    const rows = Array.from(container.querySelectorAll("button")).filter((b) =>
      b.textContent?.match(/^z\d/)
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("split-left");
    expect(rows[1].textContent).toContain("split-right");

    fireEvent.click(rows[0]);
    expect(onSelectClip).toHaveBeenCalledWith("b1_layer0");
  });
});

import { ClipInspector } from "@/components/editor/ClipInspector";

describe("ClipInspector — layer picker", () => {
  const noop = vi.fn();

  it("shows a z-ordered layer picker when the selected clip is stacked", () => {
    const selected = layeredItems[1];
    const { container } = render(
      React.createElement(ClipInspector, {
        selectedClip: selected as never,
        onUpdateClipProps: noop,
        onUpdateClipTiming: noop,
        onSwapCandidate: noop,
        onDeleteClip: noop,
        layerStack: sortByZIndex(layeredItems) as never,
        onSelectLayer: noop,
      })
    );
    expect(container.textContent).toContain("Layer Stack · 2 layers");
    const rows = Array.from(container.querySelectorAll("button")).filter((b) =>
      b.textContent?.match(/^z\d/)
    );
    expect(rows[0].textContent).toContain("split-left");
    fireEvent.click(rows[0]);
    expect(noop).toHaveBeenCalledWith("b1_layer0");
  });

  it("hides the picker for single-layer selections", () => {
    const { container } = render(
      React.createElement(ClipInspector, {
        selectedClip: clip("solo", 0, 4, { assetType: "video" }) as never,
        onUpdateClipProps: noop,
        onUpdateClipTiming: noop,
        onSwapCandidate: noop,
        onDeleteClip: noop,
      })
    );
    expect(container.textContent).not.toContain("Layer Stack");
  });
});
