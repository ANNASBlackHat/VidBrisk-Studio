// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";

vi.mock("remotion", async () => (await import("./mocks/remotion")).remotionMock());

import { KineticCaptions, KINETIC_CAPTIONS_SUPPORTED_ROLES } from "@/components/motion/KineticCaptions";
import { getMotionComponent, MOTION_COMPONENTS } from "@/components/motion/registry";

afterEach(() => {
  cleanup();
});

describe("Registry Resolution — KineticCaptions", () => {
  it("registers TextAnimations/KineticCaptions in MOTION_COMPONENTS", () => {
    expect(MOTION_COMPONENTS["TextAnimations/KineticCaptions"]).toBeDefined();
    expect(MOTION_COMPONENTS["TextAnimations/KineticCaptions"]).toBe(KineticCaptions);
  });

  it("resolves exact and case-insensitive matches", () => {
    expect(getMotionComponent("TextAnimations/KineticCaptions")).toBe(KineticCaptions);
    expect(getMotionComponent("textanimations/kineticcaptions")).toBe(KineticCaptions);
    expect(getMotionComponent("KineticCaptions")).toBe(KineticCaptions);
  });

  it("exports supported layout roles conforming to contract", () => {
    expect(KINETIC_CAPTIONS_SUPPORTED_ROLES).toContain("takeover");
    expect(KINETIC_CAPTIONS_SUPPORTED_ROLES).toContain("full");
    expect(KINETIC_CAPTIONS_SUPPORTED_ROLES).toContain("overlay-lower-third");
  });
});

describe("KineticCaptions Component", () => {
  it("renders individual word tokens with bounce properties", () => {
    const { container } = render(
      <KineticCaptions
        text="Apollo 11 mission to lunar orbit"
        durationInFrames={120}
        themeColor="#facc15"
        layoutRole="takeover"
      />
    );

    const words = container.querySelectorAll("[data-testid='caption-word']");
    expect(words.length).toBe(6);
    expect(container.textContent).toContain("Apollo");
    expect(container.textContent).toContain("lunar");
    expect(container.textContent).toContain("orbit");
  });

  it("handles structured WordTiming timestamps from WhisperX", () => {
    const timings = [
      { word: "Eagle", start: 0.0, end: 0.8 },
      { word: "has", start: 0.8, end: 1.2 },
      { word: "landed", start: 1.2, end: 2.0 },
    ];

    const { container } = render(
      <KineticCaptions
        text="Eagle has landed"
        timings={timings}
        durationInFrames={60}
        layoutRole="overlay-lower-third"
      />
    );

    const words = container.querySelectorAll("[data-testid='caption-word']");
    expect(words.length).toBe(3);
    expect(words[0].textContent).toBe("Eagle");
    expect(words[1].textContent).toBe("has");
    expect(words[2].textContent).toBe("landed");
  });

  it("applies transparent styling for overlay roles", () => {
    const { container } = render(
      <KineticCaptions
        text="Sample subtitle caption"
        layoutRole="overlay-lower-third"
      />
    );

    const rootFill = container.firstElementChild as HTMLElement;
    expect(rootFill.style.backgroundColor).toBe("transparent");
    expect(rootFill.style.pointerEvents).toBe("none");
  });
});
