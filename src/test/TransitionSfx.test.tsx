// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";

vi.mock("remotion", async () => (await import("./mocks/remotion")).remotionMock());

import { getTransitionSfx, REMOTION_SFX } from "@/lib/sfx";
import { VideoComposition } from "@/components/editor/VideoComposition";
import { EditorProjectState } from "@/adapters/timelineToEditorState";

afterEach(() => {
  cleanup();
});

describe("Transition SFX Module", () => {
  it("maps whip-pan to official Remotion whoosh sound effect", () => {
    const sfx = getTransitionSfx("whip-pan");
    expect(sfx).not.toBeNull();
    expect(sfx?.url).toBe(REMOTION_SFX.whoosh);
    expect(sfx?.volume).toBe(0.4);
    expect(sfx?.leadFrames).toBe(4);
  });

  it("maps flash to official Remotion shutter-modern sound effect", () => {
    const sfx = getTransitionSfx("flash");
    expect(sfx).not.toBeNull();
    expect(sfx?.url).toBe(REMOTION_SFX.shutterModern);
  });

  it("maps glitch to official Remotion ui-switch sound effect", () => {
    const sfx = getTransitionSfx("glitch");
    expect(sfx).not.toBeNull();
    expect(sfx?.url).toBe(REMOTION_SFX.uiSwitch);
  });

  it("returns null for none or unknown transition styles", () => {
    expect(getTransitionSfx("none")).toBeNull();
    expect(getTransitionSfx(undefined)).toBeNull();
  });
});

describe("VideoComposition Transition SFX Integration", () => {
  const baseProjectState: EditorProjectState = {
    jobId: "test-job",
    fps: 30,
    totalDuration: 10,
    width: 1280,
    height: 720,
    orientation: "horizontal",
    selectedClipId: null,
    tracks: [
      {
        id: "video",
        label: "Video",
        type: "video",
        items: [
          {
            id: "clip-1",
            trackId: "video",
            trackStart: 0,
            trackEnd: 4,
            duration: 4,
            storageUrl: "https://example.com/v1.mp4",
          },
          {
            id: "clip-2",
            trackId: "video",
            trackStart: 4,
            trackEnd: 8,
            duration: 4,
            storageUrl: "https://example.com/v2.mp4",
          },
        ],
      },
    ],
  };

  it("mounts transition whoosh SFX at boundary when transitionStyle is whip-pan", () => {
    const state: EditorProjectState = {
      ...baseProjectState,
      transitionStyle: "whip-pan",
    };

    const { container } = render(<VideoComposition projectState={state} />);
    const sfxSequence = container.querySelector('[data-sequence="transition-sfx-120"]');
    expect(sfxSequence).not.toBeNull();

    const audioElem = sfxSequence?.querySelector("audio");
    expect(audioElem).not.toBeNull();
    expect(audioElem?.getAttribute("src")).toBe(REMOTION_SFX.whoosh);
  });

  it("does not mount transition SFX when transitionStyle is none", () => {
    const state: EditorProjectState = {
      ...baseProjectState,
      transitionStyle: "none",
    };

    const { container } = render(<VideoComposition projectState={state} />);
    const sfxSequences = container.querySelectorAll('[data-sequence^="transition-sfx-"]');
    expect(sfxSequences.length).toBe(0);
  });
});
