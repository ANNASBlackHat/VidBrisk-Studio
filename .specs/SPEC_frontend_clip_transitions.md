# SPEC: Clip-Boundary Transitions (Flash Color + Whip-Pan)
**Project:** video-generation-frontend
**Status:** Draft
**Depends on:** None — builds on the existing `renderLayer`/`FootageClip`/multi-layer render loop.
**Backend changes required:** None (see §3 design note on why this is scoped as frontend-only, and the Open Question on revisiting that later).

## 1. Overview
Every effect built so far (duotone, grain, vignette, kinetic typography, etc.) lives *within* a single clip's lifetime. Nothing currently happens *between* clips — `VideoComposition`'s `videoTrack?.items.map(renderLayer)` renders each item as a fully independent `Sequence` with no awareness of what precedes or follows it. This spec adds a boundary-detection mechanism and two transition styles: **flash color** (simple overlay, no clip-internal changes needed) and **whip-pan** (needs `FootageClip` to blur+translate during its own exit/entry frames).

## 2. Current State (verified in codebase)
- `VideoComposition.tsx::renderLayer` — renders each `EditorClip` as an independent `<Sequence>`; stacking order is zIndex-sorted per the adapter, but there's no concept of temporal adjacency between clips.
- `FootageClip` — already accepts `containerStyle` and `effects` (duotone/grain/vignette), applies a baseline Ken-Burns `scale` interpolation over its own duration. No exit/entry-phase-specific behavior exists.
- `EditorClip` has `layoutRole`, `zIndex`, `trackStart`, `trackEnd` — enough to detect contiguous same-stream boundaries without new backend data.

## 3. Design Decision: Project-Level Style, Not Per-Beat
Transitions are being treated as a **project-wide stylistic setting** (like choosing a video template's "look") rather than a per-beat authored choice the LLM makes — unlike `layout_recipe`/`mood`, there's no clear semantic signal in beat text that says "this cut should whip-pan." So this spec adds a `transitionStyle` setting at the project level, applied uniformly to every contiguous cut within the same layer stream. No backend change, no `structure_beats` prompt change.

## 4. Goals
- Add a boundary-detection utility that identifies contiguous (non-overlapping, back-to-back) clip pairs within the same layer stream.
- Ship `"flash"` — a solid-color flash overlay at the cut point, purely additive (new `Sequence`, doesn't modify either clip).
- Ship `"whip-pan"` — blur+translate ramp applied to the outgoing clip's final frames and the incoming clip's opening frames, requiring `FootageClip` to accept new optional transition props.
- Both selectable via a single project-level `transitionStyle: "none" | "flash" | "whip-pan"` setting.

## Non-Goals
- Not building glitch/VHS or camera-shake-punch-in in this pass — different visual mechanism (chromatic-channel-offset compositing), separate spec.
- Not making transitions per-beat/backend-authored in v1 (see §3).
- Not exposing a UI control for this in the editor yet — set via a prop/config for testing in this pass; UI toggle is a small follow-up once the transitions themselves are validated.

## 5. Type Changes

```typescript
// src/lib/types.ts
export type TransitionStyle = "none" | "flash" | "whip-pan";
```
- `EditorProjectState` gains `transitionStyle?: TransitionStyle` (default `"none"` if unset — zero behavior change for existing projects).

## 6. Implementation

### Boundary detection (`src/lib/transitions.ts`, new file)
```typescript
interface StreamBoundary {
  a: EditorClip;
  b: EditorClip;
  boundaryFrame: number;
}

function getStreamBoundaries(items: EditorClip[], fps: number): StreamBoundary[] {
  // Group by layerRole ?? zIndex (background stream vs overlay stream must not
  // be treated as one sequence — only compare items within the same stream).
  // Sort each group by trackStart. Walk consecutive pairs; if
  // Math.abs(a.trackEnd - b.trackStart) < EPSILON (contiguous cut, not a
  // layered overlap), record a boundary at Math.round(b.trackStart * fps).
}
```
This is computed once per render in `VideoComposition`, shared by both transition styles.

### Flash transition — `src/components/motion/FlashTransition.tsx`
```typescript
interface FlashTransitionProps { color?: string; flashFrames?: number; }
```
Rendered as its own `<Sequence from={boundaryFrame - flashFrames/2} durationInFrames={flashFrames}>`, `AbsoluteFill` with `backgroundColor`, `opacity` interpolated as a spike (`[0, flashFrames/2, flashFrames] → [0, 1, 0]`). Rendered above all video layers (last in DOM order = highest z). No changes needed to `FootageClip` or `renderLayer` for the clips themselves — this is a pure overlay insertion.

### Whip-pan transition
Requires `FootageClip` to accept two new optional props:
```typescript
interface FootageClipProps {
  // ...existing props
  exitTransition?: "whip-pan";   // apply during final ~8 frames of this clip
  enterTransition?: "whip-pan";  // apply during first ~8 frames of this clip
}
```
- On exit: blur ramps 0→12px and `translateX` ramps 0→40% over the final N frames, composed with (not replacing) the existing Ken-Burns scale interpolation.
- On enter: mirrored — starts at blur 12px/`translateX` -40%, ramps to 0 over the first N frames.
- `renderLayer` sets these props by checking the precomputed boundary list: does this item's id appear as `boundary.a` (→ `exitTransition`) or `boundary.b` (→ `enterTransition`) for any boundary, gated on `projectState.transitionStyle === "whip-pan"`.

## 7. Implementation Plan
1. Add `getStreamBoundaries` utility + unit tests against fixture clip arrays (contiguous, overlapping, gapped — only contiguous same-stream pairs should produce boundaries).
2. Build `FlashTransition.tsx`; wire into `VideoComposition` — compute boundaries once, render one `<FlashTransition>` per boundary when `transitionStyle === "flash"`.
3. Extend `FootageClip` with `exitTransition`/`enterTransition` props; implement the blur+translate ramp composed with existing Ken-Burns.
4. Wire whip-pan prop assignment into `renderLayer` based on boundary membership, gated on `transitionStyle === "whip-pan"`.
5. Add `transitionStyle` to `EditorProjectState` type; thread through from wherever project state is constructed (manually settable for this test pass — no UI yet).
6. Manual QA: render a project with several contiguous background-stream cuts under each style, confirm boundaries are detected correctly and transitions look intentional, not glitchy-by-accident.

## 8. Testing
- `getStreamBoundaries`: fixture-based tests for contiguous, overlapping (multi-layer, should NOT produce a boundary), and gapped (should NOT produce a boundary) cases.
- `FlashTransition`: renders at correct frame range, opacity spike shape correct at sampled frames.
- `FootageClip` with `exitTransition`/`enterTransition`: confirm blur/translate values at first/last frame vs. mid-clip (unaffected).
- Regression: `transitionStyle: "none"` (or unset) must produce pixel-identical output to current behavior — zero risk to existing projects.

## 9. Open Questions
- Should specific beats eventually be able to request a specific transition (e.g., a myth-reveal beat explicitly wanting a `"flash"` for emphasis, overriding the project default)? If so, that would need a small backend addition — `motion_props.transition_override` — following the same optional-field pattern as `mood`/`layout_recipe`. Recommend: revisit only if the uniform project-level style proves limiting in practice.
- Whip-pan's blur+translate values (12px, 40%, 8 frames) are a starting guess — tune by eye against real footage once built, same caveat as the duotone filter values.

## 10. Acceptance Criteria
- [ ] `getStreamBoundaries` correctly distinguishes contiguous same-stream cuts from overlapping (multi-layer) and gapped clips.
- [ ] `"flash"` style renders correctly at every detected boundary, purely additive, no changes to underlying clips.
- [ ] `"whip-pan"` style renders correctly, composing with (not breaking) existing Ken-Burns zoom and any active `effects`.
- [ ] `transitionStyle: "none"`/unset produces identical output to current behavior — no regression to any existing project.
