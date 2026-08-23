// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";

vi.mock("remotion", async () => (await import("./mocks/remotion")).remotionMock());

import { StandardCard } from "@/components/motion/StandardCard";
import { SplitScreen } from "@/components/motion/SplitScreen";
import { QuoteCard } from "@/components/motion/QuoteCard";
import { StatCard } from "@/components/motion/StatCard";
import {
  resolveDisplay,
  displayContainerStyle,
} from "@/components/motion/layoutContract";

const mount = (el: React.ReactElement) => render(el);

afterEach(() => cleanup());

describe("layoutContract", () => {
  it("treats layoutRole as authoritative over deprecated aliases", () => {
    expect(
      resolveDisplay({ layoutRole: "takeover", mode: "overlay", display_mode: "overlay" })
    ).toBe("takeover");
    expect(resolveDisplay({ layoutRole: "corner-br", mode: "takeover" })).toBe("overlay");
    expect(resolveDisplay({ layoutRole: "split-left" })).toBe("split");
    expect(resolveDisplay({ layoutRole: "split-right" })).toBe("split");
  });

  it("falls back to deprecated aliases when layoutRole is absent", () => {
    expect(resolveDisplay({ mode: "overlay" })).toBe("overlay");
    expect(resolveDisplay({ mode: "takeover" })).toBe("takeover");
    expect(resolveDisplay({ display_mode: "takeover" })).toBe("takeover");
    expect(resolveDisplay({})).toBe("overlay");
  });

  it("enforces the transparency/pointer-events contract per mode", () => {
    const overlay = displayContainerStyle("overlay");
    expect(overlay).toMatchObject({
      backgroundColor: "transparent",
      pointerEvents: "none",
    });
    expect(displayContainerStyle("takeover").pointerEvents).toBeUndefined();
    expect(displayContainerStyle("takeover").backgroundColor).toBeUndefined();
  });
});

describe("StandardCard — layoutRole contract", () => {
  it("mode='overlay' and layoutRole='overlay-lower-third' are equivalent", () => {
    const { container: legacy } = mount(
      React.createElement(StandardCard, { text: "Hi", mode: "overlay" })
    );
    const { container: modern } = mount(
      React.createElement(StandardCard, { text: "Hi", layoutRole: "overlay-lower-third" })
    );
    // Both render the docked lower-third card, both click-through
    for (const c of [legacy, modern]) {
      const root = c.querySelector("[data-testid='absolute-fill']") as HTMLElement;
      expect(root.style.pointerEvents).toBe("none");
      expect(root.style.backgroundColor).toBe("transparent");
    }
  });

  it("mode='takeover' and layoutRole='full'/'takeover' render opaque full-bleed", () => {
    for (const props of [
      { text: "Hi", mode: "takeover" as const },
      { text: "Hi", layoutRole: "full" as const },
      { text: "Hi", layoutRole: "takeover" as const },
    ]) {
      const { container, unmount } = mount(React.createElement(StandardCard, props));
      const root = container.querySelector("[data-testid='absolute-fill']") as HTMLElement;
      expect(root.style.pointerEvents).not.toBe("none");
      unmount();
    }
  });
});

describe("QuoteCard / StatCard — layoutRole contract", () => {
  it("QuoteCard overlay via layoutRole is transparent and click-through", () => {
    const { container } = mount(
      React.createElement(QuoteCard, { quote: "Q", layoutRole: "overlay-lower-third" })
    );
    const root = container.querySelector("[data-testid='absolute-fill']") as HTMLElement;
    expect(root.style.pointerEvents).toBe("none");
    expect(container.textContent).toContain("Q");
  });

  it("StatCard honors takeover layoutRole over legacy overlay default", () => {
    const { container } = mount(
      React.createElement(StatCard, {
        primary_value: "$25.4B",
        layoutRole: "takeover",
      })
    );
    const roots = Array.from(
      container.querySelectorAll<HTMLElement>("[data-testid='absolute-fill']")
    );
    expect(roots.some((el) => el.style.pointerEvents === "none")).toBe(false);
  });

  it("StatCard legacy 'adaptive' mode keeps working (no layoutRole)", () => {
    const { container } = mount(
      React.createElement(StatCard, { primary_value: "$25.4B", mode: "adaptive" })
    );
    // Defaults to overlay rendering → click-through present
    const roots = Array.from(
      container.querySelectorAll<HTMLElement>("[data-testid='absolute-fill']")
    );
    expect(roots.some((el) => el.style.pointerEvents === "none")).toBe(true);
  });
});

describe("SplitScreen — decomposed halves", () => {
  it("split-left renders a single pane anchored to the left half", () => {
    const { container } = mount(
      React.createElement(SplitScreen, {
        layoutRole: "split-left",
        paneTitle: "Left pane",
        paneContent: "Left content",
      })
    );
    const root = container.querySelector("[data-testid='absolute-fill']") as HTMLElement;
    expect(root.style.pointerEvents).toBe("none");
    expect(root.style.backgroundColor).toBe("transparent");
    expect(container.textContent).toContain("LEFT PANE");
    expect(container.textContent).toContain("Left content");
    // No right-pane defaults leaking in
    expect(container.textContent).not.toContain("REMOTION AUTOMATION");
  });

  it("split-right renders a single pane anchored to the right half", () => {
    const { container } = mount(
      React.createElement(SplitScreen, {
        layoutRole: "split-right",
        paneTitle: "Right pane",
        paneContent: "Right content",
      })
    );
    expect(container.textContent).toContain("RIGHT PANE");
    expect(container.textContent).not.toContain("TRADITIONAL COST");
  });

  it("legacy two-pane API still renders both halves unchanged", () => {
    const { container } = mount(
      React.createElement(SplitScreen, {
        leftTitle: "Initial Budget",
        leftContent: "$7 Billion Target",
        rightTitle: "Actual Expenditure",
        rightContent: "$25.4 Billion Realized",
      })
    );
    expect(container.textContent).toContain("INITIAL BUDGET");
    expect(container.textContent).toContain("$7 Billion Target");
    expect(container.textContent).toContain("ACTUAL EXPENDITURE");
    expect(container.textContent).toContain("$25.4 Billion Realized");
  });
});
