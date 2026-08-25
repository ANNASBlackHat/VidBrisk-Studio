# SPEC: Multi-Layer Visual Composition — Frontend
**Project:** video-generation-frontend
**Status:** Draft
**Depends on / pairs with:** `SPEC_backend_multilayer_visuals.md`

## 1. Overview
Consume the backend's new `layers[]` field (see backend spec) to render true concurrent, z-ordered visual layers per beat — in both the live editor preview (`VideoComposition.tsx`) and the final Remotion export (`scripts/render_video.mjs`) — replacing the current overlap-detection heuristic in `timelineToEditorState.ts`.

## 2. Current State (verified in codebase)
- `src/lib/types.ts`: `TimelineJSON`, `VideoTrackItem` / `TextTrackItem` / `AudioTrackItem`, `Track` — 3 fixed track types.
- `src/adapters/timelineToEditorState.ts`: flattens backend `TimelineJSON` into `EditorProjectState` with 3 `EditorTrack`s. Contains the current "is this a motion-card overlay?" heuristic — regex-matching `$`/`%`/digits in caption text, plus a `hasOverlappingVideo` time-range check — which this spec removes for beats that carry explicit `layers`.
- `src/components/editor/VideoComposition.tsx`: renders `videoTrack` / `textTrack` / `audioTrack`, each via `.map()` into its own `<Sequence>`. Layering today only happens by accident when items in the same track array happen to overlap in time.
- `src/components/motion/StandardCard.tsx`: already has the right pattern to generalize — `display_mode: "overlay" | "takeover"` branches. `SplitScreen.tsx` and `QuoteCard.tsx` exist but don't yet share this contract.
- `src/components/editor/TimelineTracks.tsx`: one lane per track type; no concept of showing stacked/overlapping clips within a lane.
- Export path: `src/app/api/render/route.ts` shells out to `scripts/render_video.mjs` (Remotion CLI) using the same `EditorProjectState` JSON the live preview consumes — so fixing the adapter fixes both preview and final export in one place.

## 3. Goals
- Add a `layers[]`-aware path through the adapter and composition renderer.
- Give every motion component a formal `layoutRole` prop contract (generalizing `StandardCard`'s existing `display_mode` pattern).
- Let the editor UI show/select layered clips without breaking existing single-layer editing flows.

## Non-Goals
- Full timeline UI redesign — just enough to make overlapping layers visible and selectable.
- Changes to `ExportModal.tsx` quality/fps controls.

## 4. Type Changes (`src/lib/types.ts`)

```typescript
export type LayerRole = "background" | "midground" | "overlay" | "caption";
export type LayoutRole =
  | "full" | "overlay-lower-third" | "takeover"
  | "split-left" | "split-right"
  | "corner-tl" | "corner-tr" | "corner-bl" | "corner-br";

export interface Layer {
  role: LayerRole;
  z: number;
  type: "video" | "image" | "motion" | "text";
  layout: LayoutRole;
  chunkId?: string;
  sourceIn?: number;
  sourceOut?: number;
  storagePath?: string;
  storageUrl?: string;
  componentId?: string;
  content?: string;
  props?: Record<string, unknown>;
  style?: string;
}
```

- `VideoTrackItem` / `TextTrackItem`: add optional `zIndex?: number` and `layerRole?: LayerRole`, mirroring the backend's flattened `TrackItem` additions, so the adapter trusts backend ordering instead of re-deriving it.
- `EditorClip` (in `timelineToEditorState.ts`): add `zIndex?: number` and `layoutRole?: LayoutRole`.

## 5. Implementation Plan

### Phase 1 — Adapter rewrite
1. In `timelineToEditorState.ts`: when a beat's `resolved_beats[].asset_plan.layers` is present (via `timeline.metadata.resolved_beats`), map each `Layer` directly to an `EditorClip` (`trackId: "video"`, `zIndex: layer.z`, `layoutRole: layer.layout`) — skip the `hasOverlappingVideo`/regex-promotion block entirely for these beats.
2. **Backward-compat fallback**: if `layers` is absent (old timeline), keep the current heuristic path unchanged — old jobs must keep editing/rendering exactly as they do today.
3. Sort `videoItems` by `zIndex` (fallback: array order) before returning — render order in `VideoComposition` = visual stacking order.

### Phase 2 — Composition renderer
4. In `VideoComposition.tsx`, generalize `renderVideoItem` → `renderLayer(item: EditorClip)`: same type-switch as today, but now pass `item.layoutRole` through to motion components, and allow multiple items with overlapping `trackStart`/`trackEnd` to coexist as the normal case (structurally already possible — just remove the implicit exclusivity assumption).
5. Update `getMotionComponent` / `registry.ts`'s `MotionComponentProps` to formally include `layoutRole?: LayoutRole`.

### Phase 3 — Motion component updates
6. Refactor `StandardCard.tsx` to read `layoutRole` instead of its current bespoke `mode`/`display_mode` props (keep `mode` as a deprecated alias).
7. Update `SplitScreen.tsx` to accept two independently-sourced footage layers (`layoutRole: "split-left" | "split-right"`), matching the backend's `split_screen` recipe — each half becomes its own `EditorClip` rather than one component internally owning both halves, so each half can get independent zoom/Ken-Burns treatment via the existing per-item `interpolate` pattern.
8. Every motion component should declare which `layoutRole`s it supports, and render transparent/`pointerEvents: none` for overlay roles vs. opaque full-bleed for `"full"`/`"takeover"`.

### Phase 4 — Editor UI
9. `TimelineTracks.tsx`: within the video lane, group clips by overlapping time range and show a small stacked/expandable indicator (e.g. `+2 layers` badge) rather than a permanent lane per `zIndex` — keep minimal for v1.
10. `ClipInspector.tsx`: when a stacked clip is selected, show a simple `zIndex`-ordered layer picker so the user can choose which specific layer to edit.

### Phase 5 — Export path
11. Confirm `scripts/render_video.mjs` consumes the same `EditorProjectState`/`tracks` shape the adapter produces — Phase 1–2 changes should propagate to final export automatically. Add one explicit smoke test: render a layered project end-to-end via `/api/render`.

## 6. Testing
- Adapter unit tests: a fixture `TimelineJSON` with `layers[]` present vs. absent, asserting correct `EditorClip[]` output and z-order in both cases.
- Manual/visual QA: at least one `split_screen` and one `stat_over_footage` beat rendered in the live preview *and* in a final exported MP4 — confirming real compositing, not the old accidental-overlap behavior.
- Regression: existing (pre-layers) sample jobs must edit/export unchanged.

## 7. Open Questions
- Should layer z-order ever be user-editable (drag to reorder) in v1, or backend-authored/read-only? Recommend read-only for v1 — reordering safely needs more UI design than this pass should absorb.
- `SplitScreen.tsx` decomposition (one component owning both halves → two independent `EditorClip`s) is a breaking prop change. Confirm no other beat type currently depends on the existing `SplitScreenProps` shape before removing it.

## 8. Acceptance Criteria
- [ ] Adapter renders `layers[]`-based beats correctly; falls back cleanly for old timelines without `layers`.
- [ ] `VideoComposition.tsx` renders 2+ concurrent layers correctly in the live preview.
- [ ] `StandardCard` and `SplitScreen` support the new `layoutRole` prop contract.
- [ ] A layered timeline renders correctly through the actual export path (`/api/render` → `render_video.mjs`), not just the live preview.
- [ ] Old, pre-layers jobs are unaffected.
