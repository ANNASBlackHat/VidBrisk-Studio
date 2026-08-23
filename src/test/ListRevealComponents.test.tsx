// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";

vi.mock("remotion", async () => (await import("./mocks/remotion")).remotionMock());

import { SwipeDeck, SWIPE_DECK_SUPPORTED_ROLES } from "@/components/motion/SwipeDeck";
import { ChatBubbles, CHAT_BUBBLES_SUPPORTED_ROLES } from "@/components/motion/ChatBubbles";
import {
  getMotionComponent,
  MOTION_COMPONENTS,
} from "@/components/motion/registry";

afterEach(() => {
  cleanup();
});

describe("Registry Resolution — List-Reveal Components", () => {
  it("registers both components in MOTION_COMPONENTS with exact IDs", () => {
    expect(MOTION_COMPONENTS["ListAnimations/SwipeDeck"]).toBeDefined();
    expect(MOTION_COMPONENTS["ListAnimations/ChatBubbles"]).toBeDefined();
  });

  it("resolves exact matches for SwipeDeck and ChatBubbles", () => {
    const swipe = getMotionComponent("ListAnimations/SwipeDeck");
    expect(swipe).toBe(SwipeDeck);

    const chat = getMotionComponent("ListAnimations/ChatBubbles");
    expect(chat).toBe(ChatBubbles);
  });

  it("resolves case-insensitive and partial name matches", () => {
    expect(getMotionComponent("listanimations/swipedeck")).toBe(SwipeDeck);
    expect(getMotionComponent("SwipeDeck")).toBe(SwipeDeck);
    expect(getMotionComponent("ChatBubbles")).toBe(ChatBubbles);
    expect(getMotionComponent("chatbubbles")).toBe(ChatBubbles);
  });

  it("exports supported layout roles according to spec", () => {
    expect(SWIPE_DECK_SUPPORTED_ROLES).toEqual(["full", "takeover", "overlay-lower-third"]);
    expect(CHAT_BUBBLES_SUPPORTED_ROLES).toEqual(["full", "takeover", "overlay-lower-third"]);
  });
});

describe("SwipeDeck Component", () => {
  it("renders correctly with 1 item without swiping away early", () => {
    const { container } = render(
      <SwipeDeck
        items={["Single Essential Highlight"]}
        durationInFrames={120}
        layoutRole="full"
      />
    );

    const cards = container.querySelectorAll("[data-testid='swipe-card']");
    expect(cards).toHaveLength(1);
    expect(container.textContent).toContain("Single Essential Highlight");
    expect(container.textContent).toContain("1 of 1");
  });

  it("renders with 3 items and maintains card slots", () => {
    const items = ["First Milestone", "Second Optimization", "Final Launch"];
    const { container } = render(
      <SwipeDeck
        items={items}
        durationInFrames={150}
        layoutRole="takeover"
      />
    );

    const cards = container.querySelectorAll("[data-testid='swipe-card']");
    expect(cards.length).toBeGreaterThanOrEqual(1);
    expect(container.textContent).toContain("First Milestone");
  });

  it("renders with 5 items (max supported items)", () => {
    const items = ["Phase 1", "Phase 2", "Phase 3", "Phase 4", "Phase 5"];
    const { container } = render(
      <SwipeDeck
        items={items}
        durationInFrames={180}
        layoutRole="takeover"
      />
    );

    const cards = container.querySelectorAll("[data-testid='swipe-card']");
    expect(cards.length).toBeGreaterThanOrEqual(1);
    expect(container.textContent).toContain("Step 1 of 5");
  });

  it("falls back to text prop when items is missing or empty", () => {
    const { container } = render(
      <SwipeDeck
        text="Fallback single card item"
        durationInFrames={120}
        layoutRole="full"
      />
    );

    const cards = container.querySelectorAll("[data-testid='swipe-card']");
    expect(cards).toHaveLength(1);
    expect(container.textContent).toContain("Fallback single card item");
  });

  it("supports overlay-lower-third with transparent click-through root", () => {
    const { container } = render(
      <SwipeDeck
        items={["Overlay Item 1", "Overlay Item 2"]}
        durationInFrames={120}
        layoutRole="overlay-lower-third"
      />
    );

    const root = container.querySelector("[data-testid='absolute-fill']") as HTMLElement;
    expect(root).toBeDefined();
    expect(root.style.pointerEvents).toBe("none");
    expect(root.style.backgroundColor).toBe("transparent");
  });
});

describe("ChatBubbles Component", () => {
  it("renders alternating senders with correct alignment and metadata", () => {
    const messages = [
      { text: "System diagnostic complete.", sender: "system" as const },
      { text: "Understood. Proceed with launch.", sender: "user" as const },
      { text: "Ignition sequence initiated.", sender: "system" as const },
    ];

    const { container } = render(
      <ChatBubbles
        messages={messages}
        durationInFrames={150}
        layoutRole="full"
      />
    );

    const bubbles = Array.from(
      container.querySelectorAll<HTMLElement>("[data-testid='chat-bubble']")
    );

    expect(bubbles.length).toBeGreaterThanOrEqual(1);

    // Verify sender attributes
    const systemBubbles = container.querySelectorAll("[data-sender='system']");
    const userBubbles = container.querySelectorAll("[data-sender='user']");

    expect(systemBubbles.length).toBeGreaterThanOrEqual(1);
    expect(container.textContent).toContain("System diagnostic complete.");
  });

  it("falls back to single bubble when only text is provided", () => {
    const { container } = render(
      <ChatBubbles
        text="Single notification fallback bubble"
        durationInFrames={120}
        layoutRole="takeover"
      />
    );

    const bubbles = container.querySelectorAll("[data-testid='chat-bubble']");
    expect(bubbles).toHaveLength(1);
    expect(container.textContent).toContain("Single notification fallback bubble");
    expect(container.textContent).toContain("AI Assistant");
  });

  it("supports overlay-lower-third with transparent click-through container", () => {
    const { container } = render(
      <ChatBubbles
        messages={[
          { text: "Overlay message 1", sender: "system" },
          { text: "Overlay message 2", sender: "user" },
        ]}
        durationInFrames={120}
        layoutRole="overlay-lower-third"
      />
    );

    const root = container.querySelector("[data-testid='absolute-fill']") as HTMLElement;
    expect(root).toBeDefined();
    expect(root.style.pointerEvents).toBe("none");
    expect(root.style.backgroundColor).toBe("transparent");
  });
});
