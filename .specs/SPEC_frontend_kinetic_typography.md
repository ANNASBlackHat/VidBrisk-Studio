# SPEC: Kinetic Typography (Word-by-Word Reveal + Karaoke Emphasis)
**Project:** video-generation-frontend
**Status:** Draft
**Depends on:** None (backend already emits the required data — see §2)
**Scope:** 2 ideas, 1 new motion component, 2 render modes

## 1. Overview
Add a new motion component driven by per-word timing data that's already flowing through the pipeline but currently unused on the frontend: `WordTiming[]` (word, start, end, score) is present in `timeline.metadata.resolved_beats[].timings` but never attached to the `EditorClip` objects `VideoComposition.tsx` actually renders. This spec wires that data through and builds one new component, `KineticText`, with two modes:
1. **reveal** — words fade/slide in one at a time, synced to their real timestamps.
2. **karaoke** — full text visible throughout, current word highlighted (color/scale pulse) as it's spoken.

## 2. Current State (verified in codebase)
- Backend already produces `WordTiming` via `pipeline/alignment/*` (WhisperX primary), attached per beat in `ResolvedBeat.timings` and serialized into `TimelineJSON.metadata.resolved_beats[].timings`.
- Frontend `src/lib/types.ts` already has a matching `WordTiming` interface — the type exists, it's just not consumed.
- `src/adapters/timelineToEditorState.ts::timelineToEditorState` iterates `track.items` per track type but never reads `timeline.metadata.resolved_beats` to pull timings onto the resulting `EditorClip`.
- `EditorClip` interface (same file) has no `timings` field today.
- Existing motion components (`StandardCard.tsx`) establish the pattern this should follow: `useCurrentFrame()` + `interpolate()`/`spring()` driven animation, `AbsoluteFill` positioning, `display_mode`-style prop branching.

## 3. Goals
- Attach each beat's `WordTiming[]` to its corresponding `EditorClip` in the adapter.
- Ship one new component, `KineticText`, supporting `mode: "reveal" | "karaoke"`.
- Make it selectable as a `component_id` the same way `StatCard`/`QuoteCard` already are (via `beat.motion_props.component` on the backend, no backend schema change needed — just a new valid string value).

## Non-Goals
- Not touching sentiment/mood tagging or audio-beat sync (separate, already-scoped future work).
- Not building a general "any prop can be time-driven" animation framework — just this one component, two modes.

## 4. Data Flow Change (`src/adapters/timelineToEditorState.ts`)
1. Build a `beatId → WordTiming[]` lookup from `timeline.metadata?.resolved_beats` once, at the top of `timelineToEditorState`, alongside the existing `candidatesMap` lookup.
2. When constructing each `EditorClip` (both the "video" track loop and the motion-card promotion path inside the "text" track loop), attach `timings: timingsMap[beatId]` if present.
3. Add `timings?: WordTiming[]` to the `EditorClip` interface.

This is the only adapter change required — no new heuristics, no removal of existing logic.

## 5. New Component: `src/components/motion/KineticText.tsx`

```typescript
interface KineticTextProps {
  text: string;               // fallback if timings absent
  timings?: WordTiming[];     // primary driver
  mode?: "reveal" | "karaoke";
  durationInFrames: number;
  themeColor?: string;
}
```

- **Fallback behavior**: if `timings` is absent or empty (e.g. Mock aligner in dev, or an old timeline), evenly distribute words across `durationInFrames` as a synthetic timing array — component must never render blank/broken.
- **reveal mode**: each word's entrance keyed off its real `start`/`end` (converted to frames via `fps`), using the same `spring()`-based entrance pattern as `StandardCard` (opacity 0→1, small `translateY`), staggered per word rather than as one block.
- **karaoke mode**: full sentence rendered at once (word-wrap aware), current word (determined by `frame` falling within its `[start,end]` range) gets a scale/color pulse via `interpolate`; already-spoken words get a subtle dimmed state, upcoming words at rest opacity.
- Register in `src/components/motion/registry.ts` as `"TextAnimations/KineticText"`, following the existing `getMotionComponent` pattern.

## 6. Implementation Plan
1. Adapter change (§4) — attach `timings` to `EditorClip`. ~30 min, low risk, purely additive.
2. Build `KineticText.tsx`, `reveal` mode first (simpler, no "current word" lookup needed).
3. Add `karaoke` mode (needs a per-frame "which word is active" lookup — binary search or linear scan over a typically-short `timings` array, performance is a non-issue at these array sizes).
4. Register component; verify it's selectable the same way `StatCard`/`QuoteCard` are today (backend just needs to set `motion_props.component = "TextAnimations/KineticText"` on a beat — no backend code change, this is just a valid string value the existing `plan_beat_assets` motion_text branch already passes through via `motion_props.get("component", ...)`).
5. Manual QA in Remotion Studio with a real WhisperX-aligned sample job (not just Mock aligner) to confirm timing accuracy feels right at real playback speed.

## 7. Testing
- Component unit test: given a fixed `WordTiming[]` fixture, snapshot the rendered word list and confirm active-word index logic at a few sampled frames (e.g. frame 0, mid-word, mid-gap between words).
- Fallback test: `timings` omitted → confirm synthetic even-spacing fallback still renders all words within `durationInFrames`.
- Adapter test: confirm `EditorClip.timings` populated correctly from a `resolved_beats` fixture, and unaffected (`undefined`) for beats without matching timing data.

## 8. Open Questions
- Should `karaoke` mode's "active word" pulse intensity scale with the word's `score` (alignment confidence) from `WordTiming`? Low-confidence words could pulse more subtly to avoid drawing attention to a likely-misaligned word. Recommend: skip for v1, revisit if misalignment turns out to be visually noticeable in practice.
- Where should `mode` default to when not specified — `reveal` or `karaoke`? Recommend `reveal` as default since it reads as the more "typical" kinetic-type look; `karaoke` positioned as the alternate style.

## 9. Acceptance Criteria
- [ ] `EditorClip.timings` populated from `resolved_beats` in the adapter, with no regression to existing clip fields.
- [ ] `KineticText` renders correctly in both `reveal` and `karaoke` modes with real WhisperX timing data.
- [ ] Fallback (no timings) still renders correctly, no blank/broken states.
- [ ] Component selectable via `motion_props.component` exactly like existing motion cards, no backend changes required.
