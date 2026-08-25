# SPEC: Impact Transitions (Glitch/VHS Cut + Camera-Shake Entrance)
**Project:** video-generation-frontend
**Status:** Draft
**Depends on:** `SPEC_frontend_clip_transitions.md` (already implemented) — this spec extends its `TransitionStyle` union and `FootageClip` enter/exit hooks rather than building new mechanisms.
**Backend changes required:** None.

## 1. Overview
Two more "punchy" effects, both cheap extensions of infrastructure already shipped:
1. **Glitch/VHS transition** — a stylized digital-glitch flash at a clip boundary, added as a 3rd `TransitionStyle` value alongside `"flash"`/`"whip-pan"`, reusing the exact `getStreamBoundaries` + overlay-`Sequence` pattern `FlashTransition` already established.
2. **Camera-shake entrance** — a brief jitter/punch-in on a clip's opening frames, added as a `"shake"` value to `FootageClip`'s existing `enterTransition` prop (the same hook built for whip-pan's entry ramp), just with a different motion curve.

## 2. Current State (verified, post clip-transitions spec)
- `TransitionStyle = "none" | "flash" | "whip-pan"` in `src/lib/types.ts`.
- `src/lib/transitions.ts::getStreamBoundaries` — already detects contiguous same-stream cuts, shared by all transition styles.
- `FlashTransition.tsx` — proven pattern: independent `<Sequence>` overlay at the boundary frame, no changes to the clips themselves.
- `FootageClip` already accepts `exitTransition?: "whip-pan"` / `enterTransition?: "whip-pan"`, applying a blur+translate ramp composed with the baseline Ken-Burns scale.

## 3. Goals
- Add `"glitch"` to `TransitionStyle`; build `GlitchTransition.tsx` following the `FlashTransition` pattern.
- Add `"shake"` to `FootageClip`'s `enterTransition`/`exitTransition` prop type; implement a rotate/translate jitter ramp as an alternative to the existing blur/translate whip-pan ramp.

## Non-Goals
- Not doing true per-pixel RGB channel splitting on the actual video content (would need canvas/WebGL frame access) — the glitch effect is a stylized overlay approximation, same spirit as the existing duotone/vignette CSS-only approach.
- Not adding shake as a *transition* between clips (i.e., not tied to `getStreamBoundaries`) — it's scoped as a per-clip entrance style, independent of whether that clip's start happens to coincide with a detected boundary.

## 4. Implementation

### Glitch/VHS Transition (`src/components/motion/GlitchTransition.tsx`)
```typescript
interface GlitchTransitionProps { glitchFrames?: number; }
```
Pure overlay, rendered as its own `<Sequence from={boundaryFrame - glitchFrames/2} durationInFrames={glitchFrames}>`, same insertion point as `FlashTransition`. Composed of:
- 2-3 thin horizontal "slice" bars (`div`s with a solid or noise-textured fill) that jitter `translateX` by small random-looking offsets frame-to-frame (reuse the `@remotion/noise` package already used elsewhere in the codebase for organic jitter — confirm it's already a dependency from the earlier motion-tricks work before adding).
- A `repeating-linear-gradient` scanline texture overlay, `opacity` flickering on/off across a few frames.
- Optional: 2 faint color-tinted duplicate bars (cyan/red) offset by a few px horizontally, approximating chromatic aberration without real channel splitting.
No changes needed to `FootageClip` or `renderLayer` — same "pure overlay insertion" property that made `FlashTransition` simple.

### Camera-Shake Entrance
Extend the existing type:
```typescript
type ClipTransitionKind = "whip-pan" | "shake";
// FootageClip's exitTransition/enterTransition props now accept ClipTransitionKind
```
- On `enterTransition: "shake"`: over the clip's first ~6-8 frames, apply a small random `translateX`/`translateY`/`rotate` jitter (via `@remotion/noise`, same as the handheld-wobble idea from the original brainstorm) layered on top of the baseline Ken-Burns scale, decaying to 0 by the end of the window — reads as a "camera catching up" punch rather than a smooth pan.
- `exitTransition: "shake"` is technically supported by the same code path but likely less useful (shake usually reads better as an *entrance* punctuation) — support it for symmetry, don't specifically design a use case around it.
- This is purely additive to `FootageClip`'s existing prop-driven ramp system — same composition-with-Ken-Burns approach as whip-pan, just a different curve function.

## 5. Implementation Plan
1. Confirm `@remotion/noise` is already a project dependency (it was referenced for earlier motion-jitter work) — if not, it's a trivial official-Remotion-package add, not a new external dependency risk.
2. Build `GlitchTransition.tsx`; add `"glitch"` to `TransitionStyle`; wire into the same boundary-loop in `VideoComposition` that renders `FlashTransition`/whip-pan today (switch on `transitionStyle`).
3. Extend `FootageClip`'s transition prop type to `ClipTransitionKind`; implement the shake jitter ramp function alongside the existing whip-pan ramp function.
4. Manual QA: same Titanic test-script boundaries used for the flash/whip-pan verification — confirm glitch fires only at true contiguous cuts (not at the multi-layer overlap beats), and shake reads as an intentional punch-in rather than looking like a rendering glitch (ironic risk, given the name — tune amplitude/duration by eye).

## 6. Testing
- `GlitchTransition`: renders at correct frame range; jitter/opacity values sampled at a few frames stay within expected bounds (no runaway offsets).
- `FootageClip` with `enterTransition: "shake"`: confirm jitter decays to 0 by the end of the shake window, and composes correctly with an active Ken-Burns scale (doesn't fight or override it).
- Regression: `transitionStyle: "flash"`/`"whip-pan"`/`"none"` and `enterTransition` unset must remain unaffected by this addition — purely additive union members, no existing branch logic changed.

## 7. Open Questions
- Should `"shake"` ever be triggered automatically (e.g., on beats tagged with an urgent `mood`, from the sentiment-color-grade spec), rather than manually set? Recommend: keep manual/style-driven for now, consistent with the project-level transition-style decision already made — revisit only if there's a clear case for semantic auto-triggering later.
- Glitch's "chromatic tint bars" approximation may or may not read convincingly without true channel-splitting. Worth an early visual gut-check before investing in polishing the effect further — if it looks unconvincing, a canvas-based true RGB-split approach is a larger follow-up, not a quick fix.

## 8. Acceptance Criteria
- [ ] `"glitch"` transition style renders correctly at detected boundaries, no false positives at multi-layer overlaps.
- [ ] `enterTransition`/`exitTransition: "shake"` renders correctly, composes with Ken-Burns, decays smoothly.
- [ ] No regressions to `"flash"`, `"whip-pan"`, or `"none"` behavior from `SPEC_frontend_clip_transitions.md`.
