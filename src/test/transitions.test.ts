import { describe, it, expect } from "vitest";
import { getStreamBoundaries, normalizeStreamKey } from "@/lib/transitions";
import { EditorClip } from "@/adapters/timelineToEditorState";

const makeClip = (
  id: string,
  trackStart: number,
  trackEnd: number,
  layoutRole?: EditorClip["layoutRole"],
  zIndex?: number
): EditorClip => ({
  id,
  trackId: "video",
  trackStart,
  trackEnd,
  duration: trackEnd - trackStart,
  layoutRole,
  zIndex,
});

describe("getStreamBoundaries", () => {
  it("returns empty array for empty or single item arrays", () => {
    expect(getStreamBoundaries([], 30)).toEqual([]);
    expect(getStreamBoundaries([makeClip("c1", 0, 4)], 30)).toEqual([]);
  });

  it("detects contiguous same-stream cuts within EPSILON tolerance", () => {
    const clips: EditorClip[] = [
      makeClip("c1", 0, 3.5),
      makeClip("c2", 3.5, 7.0),
      makeClip("c3", 7.02, 10.0), // within 0.05s epsilon
    ];

    const boundaries = getStreamBoundaries(clips, 30);
    expect(boundaries).toHaveLength(2);
    expect(boundaries[0].a.id).toBe("c1");
    expect(boundaries[0].b.id).toBe("c2");
    expect(boundaries[0].boundaryFrame).toBe(105); // 3.5 * 30

    expect(boundaries[1].a.id).toBe("c2");
    expect(boundaries[1].b.id).toBe("c3");
    expect(boundaries[1].boundaryFrame).toBe(211); // Math.round(7.02 * 30) = 211
  });

  it("ignores gapped cuts exceeding EPSILON", () => {
    const clips: EditorClip[] = [
      makeClip("c1", 0, 3.0),
      makeClip("c2", 3.2, 6.0), // 0.2s gap > 0.05s
    ];

    const boundaries = getStreamBoundaries(clips, 30);
    expect(boundaries).toHaveLength(0);
  });

  it("ignores overlapping clips (multi-layer coexistence)", () => {
    const clips: EditorClip[] = [
      makeClip("c1", 0, 4.0),
      makeClip("c2", 2.0, 6.0), // 2.0s overlap
    ];

    const boundaries = getStreamBoundaries(clips, 30);
    expect(boundaries).toHaveLength(0);
  });

  it("does not generate boundaries across different layer streams", () => {
    const clips: EditorClip[] = [
      makeClip("bg1", 0, 4.0, "full"),
      makeClip("ov1", 4.0, 8.0, "corner-tl"), // starts right when bg1 ends, but different stream
      makeClip("bg2", 4.0, 8.0, "full"),
    ];

    const boundaries = getStreamBoundaries(clips, 30);
    // Only bg1 -> bg2 should form a boundary, not bg1 -> ov1
    expect(boundaries).toHaveLength(1);
    expect(boundaries[0].a.id).toBe("bg1");
    expect(boundaries[0].b.id).toBe("bg2");
    expect(boundaries[0].boundaryFrame).toBe(120);
  });

  it("groups undefined layoutRole and 'full' layoutRole with default zIndex into the same base stream", () => {
    const clips: EditorClip[] = [
      makeClip("c1", 0, 3.0, undefined),
      makeClip("c2", 3.0, 6.0, "full"),
    ];

    const boundaries = getStreamBoundaries(clips, 30);
    expect(boundaries).toHaveLength(1);
    expect(boundaries[0].a.id).toBe("c1");
    expect(boundaries[0].b.id).toBe("c2");
  });

  it("normalizes stream key correctly", () => {
    expect(normalizeStreamKey(makeClip("c1", 0, 1, undefined, 0))).toBe("base#0");
    expect(normalizeStreamKey(makeClip("c2", 0, 1, "full", 0))).toBe("base#0");
    expect(normalizeStreamKey(makeClip("c3", 0, 1, "corner-tr", 1))).toBe("corner-tr#1");
  });
});
