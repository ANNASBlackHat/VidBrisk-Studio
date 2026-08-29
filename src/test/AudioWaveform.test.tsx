// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";

vi.mock("remotion", async () => (await import("./mocks/remotion")).remotionMock());

import { AudioWaveform, AUDIO_WAVEFORM_SUPPORTED_ROLES } from "@/components/motion/AudioWaveform";
import { getMotionComponent, MOTION_COMPONENTS } from "@/components/motion/registry";

afterEach(() => {
  cleanup();
});

describe("Registry Resolution — AudioWaveform", () => {
  it("registers AudioAnimations/AudioWaveform in MOTION_COMPONENTS", () => {
    expect(MOTION_COMPONENTS["AudioAnimations/AudioWaveform"]).toBeDefined();
    expect(MOTION_COMPONENTS["AudioAnimations/AudioWaveform"]).toBe(AudioWaveform);
  });

  it("resolves exact and case-insensitive matches", () => {
    expect(getMotionComponent("AudioAnimations/AudioWaveform")).toBe(AudioWaveform);
    expect(getMotionComponent("audioanimations/audiowaveform")).toBe(AudioWaveform);
    expect(getMotionComponent("AudioWaveform")).toBe(AudioWaveform);
  });

  it("exports supported layout roles conforming to contract", () => {
    expect(AUDIO_WAVEFORM_SUPPORTED_ROLES).toContain("takeover");
    expect(AUDIO_WAVEFORM_SUPPORTED_ROLES).toContain("full");
    expect(AUDIO_WAVEFORM_SUPPORTED_ROLES).toContain("overlay-lower-third");
  });
});

describe("AudioWaveform Component", () => {
  it("renders speaker attribution, telemetry HUD, and quote", () => {
    const { container } = render(
      <AudioWaveform
        speaker="Neil Armstrong"
        title="Lunar Comms Stream"
        subtext="RADIO FEED"
        quote="That's one small step for man, one giant leap for mankind."
        barCount={24}
        layoutRole="takeover"
      />
    );

    expect(container.textContent).toContain("Neil Armstrong");
    expect(container.textContent).toContain("Lunar Comms Stream");
    expect(container.textContent).toContain("RADIO FEED");
    expect(container.textContent).toContain("That's one small step for man, one giant leap for mankind.");
    expect(container.textContent).toContain("44.1 kHz • LIVE");

    const spectrum = container.querySelector("[data-testid='waveform-spectrum']");
    expect(spectrum).not.toBeNull();
    expect(spectrum?.children.length).toBe(24);
  });

  it("applies transparent styling for overlay roles", () => {
    const { container } = render(
      <AudioWaveform
        speaker="Houston CAPCOM"
        layoutRole="overlay-lower-third"
      />
    );

    const rootFill = container.firstElementChild as HTMLElement;
    expect(rootFill.style.backgroundColor).toBe("transparent");
    expect(rootFill.style.pointerEvents).toBe("none");
  });
});
