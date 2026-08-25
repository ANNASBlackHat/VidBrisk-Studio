// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import React from "react";
import { ScriptReview } from "@/components/checkpoints/ScriptReview";
import { JobResponse } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  api: {
    approveJob: vi.fn().mockResolvedValue({ status: "success" }),
  },
}));

afterEach(() => {
  cleanup();
});

const mockJob: JobResponse = {
  id: "test-job-123",
  status: "awaiting_approval",
  stage: "structuring",
  tts_provider: "mock",
  aligner_provider: "mock",
  target_orientation: "horizontal",
  auto_approve: false,
  single_pass_llm: false,
  created_at: "2026-08-23T10:00:00Z",
  updated_at: "2026-08-23T10:05:00Z",
  clean_script: "Welcome to Apollo 11. Over $25B was spent on the mission.",
  raw_input: "Welcome to Apollo 11. Over $25B was spent on the mission.",
  beats: [
    {
      id: "b1",
      text: "Welcome to Apollo 11 mission.",
      visual_intent: "Saturn V rocket launch",
      beat_type: "narrative",
    },
    {
      id: "b2",
      text: "Over $25B was invested.",
      visual_intent: "Statistical budget graphic",
      beat_type: "stat",
      motion_props: {
        component: "DataAnimations/StatCard",
        primary_value: "$25B",
        visual_type: "chart",
      },
    },
  ],
};

describe("ScriptReview — Motion Component Options", () => {
  it("renders all 8 visual style options in the beat dropdown", () => {
    const onApproved = vi.fn();
    const { container } = render(
      <ScriptReview job={mockJob} onApproved={onApproved} />
    );

    const selects = container.querySelectorAll("select");
    expect(selects.length).toBe(2);

    const options = Array.from(selects[0].querySelectorAll("option")).map(
      (opt) => opt.value
    );

    expect(options).toEqual([
      "narrative",
      "split_screen",
      "stat",
      "quote",
      "kinetic",
      "typewriter",
      "swipe_deck",
      "chat_bubbles",
    ]);
  });

  it("updates beat type and motion props when switching to swipe_deck or chat_bubbles", () => {
    const onApproved = vi.fn();
    const { container } = render(
      <ScriptReview job={mockJob} onApproved={onApproved} />
    );

    const select = container.querySelectorAll("select")[0];

    // Change b1 from narrative to swipe_deck
    fireEvent.change(select, { target: { value: "swipe_deck" } });

    expect(container.textContent).toContain("Swipe Deck");

    // Change b1 to chat_bubbles
    fireEvent.change(select, { target: { value: "chat_bubbles" } });

    expect(container.textContent).toContain("Chat Bubbles");
  });
});
