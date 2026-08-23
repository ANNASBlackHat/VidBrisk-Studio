import { describe, it, expect } from "vitest";
import { timelineToEditorState, EditorProjectState } from "@/adapters/timelineToEditorState";
import { makeLegacyTimeline } from "./fixtures/legacyTimeline";
import { makeLayeredTimeline } from "./fixtures/layeredTimeline";

const videoClips = (s: EditorProjectState) =>
  s.tracks.find((t) => t.id === "video")!.items;

describe("timelineToEditorState — legacy (no layers)", () => {
  it("keeps the heuristic path intact: caption stays in text track", () => {
    const state = timelineToEditorState(makeLegacyTimeline(), "horizontal", "job_legacy");
    const textTrack = state.tracks.find((t) => t.id === "text")!;
    expect(textTrack.items).toHaveLength(1);
    expect(textTrack.items[0].content).toBe("A quiet revolution in energy");
  });

  it("promotes the $-containing text item to a StatCard overlay motion clip", () => {
    const clips = videoClips(timelineToEditorState(makeLegacyTimeline()));
    const stat = clips.find((c) => c.componentId === "DataAnimations/StatCard");
    expect(stat).toBeDefined();
    // txt_b2_stat overlaps footage clip_b2 → heuristic yields "overlay"
    expect(stat!.props!.mode).toBe("overlay");
    expect(stat!.props!.primary_value).toBe("$25.4 BILLION");
  });

  it("attaches beatId and candidates to legacy clips", () => {
    const clips = videoClips(timelineToEditorState(makeLegacyTimeline()));
    const b1 = clips.find((c) => c.beatId === "b1")!;
    expect(b1.candidates).toHaveLength(1);
    expect(b1.candidates![0].chunk_id).toBe("c1");
  });
});

describe("timelineToEditorState — layered beats", () => {
  const state = timelineToEditorState(makeLayeredTimeline(), "horizontal", "job_layered");

  it("emits one clip per layer with correct zIndex and layoutRole", () => {
    const b1 = videoClips(state).filter((c) => c.beatId === "b1");
    expect(b1).toHaveLength(2);

    const left = b1.find((c) => c.layoutRole === "split-left")!;
    const right = b1.find((c) => c.layoutRole === "split-right")!;
    expect(left.zIndex).toBe(0);
    expect(right.zIndex).toBe(1);
    expect(left.storageUrl).toBe("http://media.local/split_left.mp4");
    expect(right.sourceIn).toBe(20);
    expect(right.sourceOut).toBe(24);
  });

  it("maps layer types to asset types (video→video, motion→motion)", () => {
    const b2 = videoClips(state).filter((c) => c.beatId === "b2");
    expect(b2.map((c) => c.assetType).sort()).toEqual(["motion", "video"]);
    const overlay = b2.find((c) => c.layoutRole === "overlay-lower-third")!;
    expect(overlay.componentId).toBe("DataAnimations/StatCard");
    expect(overlay.props).toEqual({ primary_value: "$25.4B" });
  });

  it("places layer clips on the beat's timeline window derived from track items", () => {
    const b1 = videoClips(state).filter((c) => c.beatId === "b1");
    for (const clip of b1) {
      expect(clip.trackStart).toBe(0);
      expect(clip.trackEnd).toBe(4);
      expect(clip.duration).toBe(4);
    }
  });

  it("skips flat track items for layered beats (no duplicates, no regex promotion)", () => {
    const clips = videoClips(state);
    // Original flat ids must not survive
    expect(clips.find((c) => c.id === "clip_b1")).toBeUndefined();
    expect(clips.find((c) => c.id === "clip_b2")).toBeUndefined();
    // No heuristic-promoted motion id from txt_b2_stat
    expect(clips.find((c) => c.id.includes("txt_"))).toBeUndefined();
    expect(clips.filter((c) => c.assetType === "motion")).toHaveLength(1);
    // Total: 2 layers (b1) + 2 layers (b2)
    expect(clips).toHaveLength(4);
  });

  it("renders overlapping layer clips concurrently within the same window", () => {
    const b2 = videoClips(state).filter((c) => c.beatId === "b2");
    const [bg, overlay] = [...b2].sort((a, b) => a.zIndex! - b.zIndex!);
    expect(bg.trackStart).toBe(overlay.trackStart);
    expect(bg.trackEnd).toBe(overlay.trackEnd);
    expect(overlay.layoutRole).toBe("overlay-lower-third");
  });

  it("sorts by zIndex for simultaneous start times (render order = stacking order)", () => {
    const b1 = videoClips(state).filter((c) => c.beatId === "b1");
    expect(b1[0].zIndex).toBeLessThan(b1[1].zIndex!);
  });

  it("attaches footage candidates to background layer clips", () => {
    const b1 = videoClips(state).filter((c) => c.beatId === "b1");
    expect(b1.every((c) => c.candidates?.[0].chunk_id === "c9")).toBe(true);
  });
});

describe("timelineToEditorState — mixed & edge cases", () => {
  it("handles a beat with layers but no matching track items via voice_clip fallback window", () => {
    const timeline = makeLayeredTimeline();
    timeline.tracks = timeline.tracks.filter((t) => t.type !== "video");
    const state = timelineToEditorState(timeline);
    const b1 = videoClips(state).filter((c) => c.beatId === "b1");
    expect(b1).toHaveLength(2);
    expect(b1[0].trackStart).toBe(0);
    expect(b1[0].trackEnd).toBe(4);
  });

  it("falls back to legacy handling when layers array is empty", () => {
    const timeline = makeLegacyTimeline();
    timeline.metadata!.resolved_beats![1].asset_plan = {
      strategy: "single_clip",
      items: [],
      layers: [],
    };
    const state = timelineToEditorState(timeline);
    const stat = videoClips(state).find((c) => c.componentId === "DataAnimations/StatCard");
    expect(stat).toBeDefined();
    expect(stat!.zIndex).toBeUndefined();
  });

  it("preserves explicit zIndex from flattened backend TrackItems on the legacy path", () => {
    const timeline = makeLegacyTimeline();
    (timeline.tracks[0].items[0] as { zIndex?: number }).zIndex = 3;
    const clips = videoClips(timelineToEditorState(timeline));
    expect(clips[0].zIndex).toBe(3);
  });
});

describe("timelineToEditorState — word timings mapping", () => {
  it("attaches WordTiming[] from resolved_beats to matching EditorClips", () => {
    const timeline = makeLegacyTimeline();
    timeline.metadata!.resolved_beats![0].timings = [
      { word: "A", start: 0.1, end: 0.3, score: 0.99 },
      { word: "quiet", start: 0.3, end: 0.7, score: 0.95 },
      { word: "revolution", start: 0.7, end: 1.4, score: 0.96 },
    ];

    const state = timelineToEditorState(timeline);
    const videoClipB1 = videoClips(state).find((c) => c.beatId === "b1");
    expect(videoClipB1).toBeDefined();
    expect(videoClipB1!.timings).toHaveLength(3);
    expect(videoClipB1!.timings![0].word).toBe("A");

    const textClipB1 = state.tracks.find((t) => t.id === "text")!.items.find((c) => c.beatId === "b1");
    expect(textClipB1).toBeDefined();
    expect(textClipB1!.timings).toHaveLength(3);
  });

  it("leaves timings undefined when resolved_beats has no timings", () => {
    const timeline = makeLegacyTimeline();
    const state = timelineToEditorState(timeline);
    const videoClipB1 = videoClips(state).find((c) => c.beatId === "b1");
    expect(videoClipB1).toBeDefined();
    expect(videoClipB1!.timings).toBeUndefined();
  });
});

describe("timelineToEditorState — footage effects", () => {
  it("attaches effects from props.effects to EditorClips", () => {
    const timeline = makeLegacyTimeline();
    (timeline.tracks[0].items[0] as { props?: Record<string, unknown> }).props = {
      effects: {
        colorTreatment: "duotone-cool",
        grain: true,
        grainIntensity: 0.2,
        vignette: true,
      },
    };

    const state = timelineToEditorState(timeline);
    const clip = videoClips(state)[0];
    expect(clip.effects).toEqual({
      colorTreatment: "duotone-cool",
      grain: true,
      grainIntensity: 0.2,
      vignette: true,
    });
  });

  it("leaves effects undefined when props has no effects", () => {
    const timeline = makeLegacyTimeline();
    const state = timelineToEditorState(timeline);
    const clip = videoClips(state)[0];
    expect(clip.effects).toBeUndefined();
  });
});


