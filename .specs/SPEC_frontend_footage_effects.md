# SPEC: Footage Effects — Duotone Color-Grade + Grain/Vignette Atmosphere
**Project:** video-generation-frontend
**Status:** Draft
**Depends on:** None — builds on the already-implemented multi-layer renderer (`renderLayer`, `FootageClip`, `layerGeometry`)
**Scope:** 2 ideas, 1 new `effects` prop, applied within the existing single-clip renderer

## 1. Overview
Add two purely cosmetic, CSS-only treatments applicable to any footage/image layer: a **duotone/color-grade filter** and a **grain + vignette atmosphere pulse**. Both are stackable CSS `filter`/overlay effects, no new dependency, no layering changes — they apply *within* `FootageClip`, the same component that already renders every video/image layer (background, midground, or overlay alike) post-multi-layer-refactor.

## 2. Current State (verified in codebase, post-layering-refactor)
- `src/components/editor/VideoComposition.tsx::renderLayer` — the generalized per-layer renderer (formerly `renderVideoItem`). For non-motion layers it computes `geometry = layerGeometry(item.layoutRole)` and passes it into `FootageClip` as `containerStyle`.
- `FootageClip` — renders an `AbsoluteFill` wrapping a Remotion `<Video>`, with a baseline Ken-Burns zoom (`scale` interpolated 1.0 → 1.05 over the clip's duration) and `containerStyle` spread onto the outer `AbsoluteFill`. This is the single choke point every footage/image layer passes through — the right place to add optional visual treatments.
- `EditorClip` (in `src/adapters/timelineToEditorState.ts`) already carries `layoutRole`, `zIndex`, `timings`, `props` — no `effects`-style field yet.
- No chart/particle/filter library present in `package.json`; everything is native CSS `filter`/`background`, consistent with the rest of the codebase's approach.

## 3. Goals
- Add an `effects?: FootageEffects` field to `EditorClip`, settable via `item.props.effects` from the backend (same pattern as `motion_props` today — no backend schema change required, just a new optional key inside the existing `props: Record<string, unknown>` dict).
- `FootageClip` applies the requested `colorTreatment` (duotone variants) and/or `grain`/`vignette` overlay without altering its existing Ken-Burns/geometry behavior.
- Both effects must be combinable with any `layoutRole` (full-bleed, split-left/right, overlay corners) — they're purely visual layers on top of the existing render, not layout-affecting.

## Non-Goals
- Not adding true LUT-based color grading (would require ffmpeg-level work in the backend renderer) — this is a CSS `filter`-approximation only, intentionally.
- Not adding a UI control panel for authoring these per-clip in the editor in this pass — effects are backend/preset-driven for v1 (see §7 Open Questions).

## 4. Type Changes

```typescript
// src/lib/types.ts
export type ColorTreatment = "none" | "duotone-cool" | "duotone-warm" | "duotone-mono";

export interface FootageEffects {
  colorTreatment?: ColorTreatment;
  grain?: boolean;          // subtle animated noise overlay
  grainIntensity?: number;  // 0–1, default 0.15 if grain=true and unset
  vignette?: boolean;       // radial darkened edges, pulses subtly on beat entrance
}
```

- `EditorClip` gains `effects?: FootageEffects`.
- In `timelineToEditorState.ts`, when building a video-track `EditorClip`, read `effects` off `item.props?.effects` (same dict the backend already sends `motion_props`/`props` through) — no new adapter logic beyond a pass-through field read.

## 5. Implementation

### `colorTreatment` (duotone)
CSS `filter` stack applied to the `<Video>` element (or a sibling overlay `div` with `mix-blend-mode` for the tinted-highlight/shadow look, whichever renders more faithfully — spike both, pick one):
- `duotone-cool`: `grayscale(1) contrast(1.1) sepia(0.3) hue-rotate(180deg) saturate(1.4)` as a starting point — tune visually.
- `duotone-warm`: same base, `hue-rotate(-20deg)`.
- `duotone-mono`: `grayscale(1) contrast(1.15)`.
Exact filter values are a design/tuning task, not an engineering unknown — implementer should treat the values above as a starting point and adjust by eye against real footage.

### `grain` + `vignette`
- **Grain**: a semi-transparent `AbsoluteFill` sibling layer inside `FootageClip`, using an SVG `feTurbulence`/`feColorMatrix` filter (inline `<svg>` `<filter>` def, referenced via CSS `filter: url(#grain)`) or a small tiled noise data-URI background — either works, no external asset needed. Opacity driven by `grainIntensity`.
- **Vignette**: `radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%)` as a sibling overlay div; "pulse" behavior reuses the same `interpolate`-on-`frame` pattern already used for the Ken-Burns `scale`, keyed to the clip's entrance window (first ~15% of `durationFrames`, matching the entrance-timing convention already established in `StandardCard`).

### Wiring into `FootageClip`
```typescript
const FootageClip: React.FC<{
  resolvedUrl: string;
  startFromFrames: number;
  durationFrames: number;
  containerStyle?: React.CSSProperties;
  effects?: FootageEffects;   // NEW
}> = ({ resolvedUrl, startFromFrames, durationFrames, containerStyle, effects }) => {
  // existing scale interpolation unchanged
  // + colorTreatment → filter string applied to <Video> style
  // + grain/vignette → additional sibling AbsoluteFill layers inside the same outer AbsoluteFill
};
```
`renderLayer` passes `effects={item.effects}` alongside the existing `containerStyle` prop — one-line addition at the `<FootageClip ... />` call site.

## 6. Implementation Plan
1. Add types (`FootageEffects`, `ColorTreatment`) to `src/lib/types.ts` and `EditorClip`.
2. Adapter: read `item.props?.effects` into `EditorClip.effects` in `timelineToEditorState.ts` (video-track loop only — motion layers don't need this).
3. Extend `FootageClip` to accept and apply `effects` (color filter on `<Video>`, grain/vignette as sibling overlay divs).
4. Wire `effects` through `renderLayer`'s `<FootageClip />` call.
5. Manual QA: apply each `colorTreatment` value and `grain`/`vignette` toggles against a few real footage clips in Remotion Studio, tune filter values by eye.
6. Confirm combinability: an overlay-role layer (e.g. a split-screen half) with `effects` set still respects its `layerGeometry` positioning — effects must not interfere with the existing geometry/`pointerEvents` logic already in `renderLayer`.

## 7. Testing
- Component test: `FootageClip` with each `colorTreatment` value renders without throwing, produces the expected `filter` CSS string.
- Component test: `grain`/`vignette` toggles independently (all 4 combinations: neither, grain only, vignette only, both).
- Adapter test: `EditorClip.effects` correctly read from `props.effects`, `undefined` when absent (no regression to clips without effects set).
- Visual regression: confirm baseline Ken-Burns zoom behavior is unaffected when `effects` is unset (default/no-op case must be pixel-identical to current behavior).

## 8. Open Questions
- **Who decides which clips get which effect?** For v1, recommend this stays backend-driven (same as `layout_recipe` in the multi-layer spec) — e.g. sentiment-tagged beats could map to `duotone-cool`/`duotone-warm` once that data feed exists, or it's simply set manually per-job for now. An editor-UI effect picker is a reasonable v2 once the effects themselves are validated visually.
- **Should grain be a static overlay or per-frame animated (true "film grain" flicker)?** Static is far cheaper (one repeating background, no per-frame regeneration) and likely indistinguishable at normal viewing speed; animated grain requires either a precomputed noise-frame sequence or a more expensive per-frame SVG regeneration. Recommend starting static, revisit only if it reads as too flat in practice.

## 9. Acceptance Criteria
- [ ] `FootageEffects` type added; `EditorClip.effects` populated from `props.effects` with no backend schema change.
- [ ] All 3 `colorTreatment` values render distinctly and correctly on real footage.
- [ ] `grain` and `vignette` render correctly, independently and combined, without breaking existing Ken-Burns zoom or `layerGeometry` positioning.
- [ ] Default (no `effects` set) behavior is unchanged from current `FootageClip` output.
