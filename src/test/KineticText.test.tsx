// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";
import type { CSSProperties, ReactNode } from "react";
import { WordTiming } from "@/lib/types";

let mockedFrame = 0;

vi.mock("remotion", () => {
  const AbsoluteFill = ({
    style,
    children,
  }: {
    style?: CSSProperties;
    children?: ReactNode;
  }) =>
    React.createElement(
      "div",
      { style, "data-testid": "absolute-fill" },
      children
    );
  const useVideoConfig = () => ({ fps: 30, durationInFrames: 120 });
  const useCurrentFrame = () => mockedFrame;
  const interpolate = (
    frame: number,
    input: number[],
    output: number[]
  ) => {
    if (input.length === 2) {
      if (frame <= input[0]) return output[0];
      if (frame >= input[1]) return output[1];
      return (
        output[0] +
        ((frame - input[0]) / (input[1] - input[0])) * (output[1] - output[0])
      );
    }
    if (input.length === 3) {
      if (frame <= input[0]) return output[0];
      if (frame >= input[2]) return output[2];
      if (frame <= input[1]) {
        return (
          output[0] +
          ((frame - input[0]) / (input[1] - input[0])) * (output[1] - output[0])
        );
      }
      return (
        output[1] +
        ((frame - input[1]) / (input[2] - input[1])) * (output[2] - output[1])
      );
    }
    return output[0];
  };
  const spring = ({ frame }: { frame: number }) =>
    Math.min(1, Math.max(0, frame / 10));

  return {
    AbsoluteFill,
    useVideoConfig,
    useCurrentFrame,
    interpolate,
    spring,
  };
});

import { KineticText } from "@/components/motion/KineticText";

const sampleTimings: WordTiming[] = [
  { word: "Deep", start: 0.0, end: 0.5, score: 0.98 },
  { word: "learning", start: 0.5, end: 1.2, score: 0.95 },
  { word: "changes", start: 1.2, end: 1.8, score: 0.92 },
  { word: "everything", start: 1.8, end: 2.6, score: 0.97 },
];

afterEach(() => {
  cleanup();
  mockedFrame = 0;
});

describe("KineticText — Reveal Mode", () => {
  it("renders with reveal mode by default, staggering word visibility across timestamps", () => {
    // Frame 0: First word ('Deep') should be starting entrance, later words hidden (opacity 0)
    mockedFrame = 0;
    const { container, rerender } = render(
      <KineticText
        text="Deep learning changes everything"
        timings={sampleTimings}
        mode="reveal"
        durationInFrames={90}
        themeColor="#38bdf8"
      />
    );

    const words = Array.from(
      container.querySelectorAll<HTMLElement>("[data-testid='kinetic-word']")
    );
    expect(words).toHaveLength(4);

    // Frame 0: 'Deep' is at frame 0, opacity >= 0, subsequent words have opacity 0
    expect(words[0].textContent).toBe("Deep");
    expect(words[1].textContent).toBe("learning");
    expect(words[1].style.opacity).toBe("0");
    expect(words[2].style.opacity).toBe("0");
    expect(words[3].style.opacity).toBe("0");

    // Frame 25 (~0.83s, during 'learning'): 'Deep' and 'learning' are revealed
    mockedFrame = 25;
    rerender(
      <KineticText
        text="Deep learning changes everything"
        timings={sampleTimings}
        mode="reveal"
        durationInFrames={90}
        themeColor="#38bdf8"
      />
    );
    const updatedWords = Array.from(
      container.querySelectorAll<HTMLElement>("[data-testid='kinetic-word']")
    );
    expect(Number(updatedWords[0].style.opacity)).toBeGreaterThan(0.9);
    expect(Number(updatedWords[1].style.opacity)).toBeGreaterThan(0.9);
    expect(updatedWords[2].style.opacity).toBe("0");
    expect(updatedWords[3].style.opacity).toBe("0");

    // Frame 70 (~2.33s, after all started): all words are revealed
    mockedFrame = 70;
    rerender(
      <KineticText
        text="Deep learning changes everything"
        timings={sampleTimings}
        mode="reveal"
        durationInFrames={90}
        themeColor="#38bdf8"
      />
    );
    const finalWords = Array.from(
      container.querySelectorAll<HTMLElement>("[data-testid='kinetic-word']")
    );
    for (const w of finalWords) {
      expect(Number(w.style.opacity)).toBeGreaterThan(0.9);
    }
  });
});

describe("KineticText — Karaoke Mode", () => {
  it("renders all words visibly from frame 0 and highlights the active word", () => {
    // Frame 20 (~0.66s, inside 'learning' [0.5s - 1.2s] = [15f - 36f])
    mockedFrame = 20;
    const { container } = render(
      <KineticText
        text="Deep learning changes everything"
        timings={sampleTimings}
        mode="karaoke"
        durationInFrames={90}
        themeColor="#a855f7"
      />
    );

    const words = Array.from(
      container.querySelectorAll<HTMLElement>("[data-testid='kinetic-word']")
    );
    expect(words).toHaveLength(4);

    // 'Deep' is past (index 0 < activeIndex 1) -> dimmed opacity
    expect(words[0].style.opacity).toBe("0.55");
    // 'learning' is active (index 1 === activeIndex 1) -> opacity 1.0, color #a855f7 / rgb(168, 85, 247)
    expect(words[1].style.opacity).toBe("1");
    expect(["#a855f7", "rgb(168, 85, 247)"]).toContain(words[1].style.color);
    // 'changes' & 'everything' are upcoming -> rest opacity 0.85
    expect(words[2].style.opacity).toBe("0.85");
    expect(words[3].style.opacity).toBe("0.85");
  });
});

describe("KineticText — Fallback Behavior", () => {
  it("synthetically distributes words across duration when timings is omitted or empty", () => {
    mockedFrame = 0;
    const { container } = render(
      <KineticText
        text="Innovation accelerates future breakthroughs"
        mode="reveal"
        durationInFrames={120}
      />
    );

    const words = Array.from(
      container.querySelectorAll<HTMLElement>("[data-testid='kinetic-word']")
    );
    expect(words).toHaveLength(4);
    expect(words.map((s) => s.textContent)).toEqual([
      "Innovation",
      "accelerates",
      "future",
      "breakthroughs",
    ]);
  });
});

describe("KineticText — Layout Contract", () => {
  it("renders overlay lower-third container when layoutRole is overlay-lower-third", () => {
    const { container } = render(
      <KineticText
        text="Testing overlay role"
        layoutRole="overlay-lower-third"
      />
    );

    const words = Array.from(
      container.querySelectorAll<HTMLElement>("[data-testid='kinetic-word']")
    );
    expect(words.map((w) => w.textContent).join(" ")).toBe("Testing overlay role");
    const fill = container.querySelector("[data-testid='absolute-fill']") as HTMLElement;
    expect(fill.style.pointerEvents).toBe("none");
  });
});
