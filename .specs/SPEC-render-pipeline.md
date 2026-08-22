# SPEC — Render Pipeline: Mechanism, Current State, and the Fallback-Safety Fix

## 1. Purpose

This is a **standalone spec**, not an amendment to the prior four. It exists because a real
code review (via the indexed `video-generation-frontend` / `video-generation-pipeline`
repositories) surfaced a concrete architectural finding: there are **two independent render
paths** in the current implementation, one of which can silently produce degraded output. This
spec documents the actual render mechanism, states the finding precisely, and specifies the fix.

## 2. How the Primary Render Path Actually Works (confirmed, not hypothetical)

Neither Chromium nor FFmpeg can produce the final video alone — FFmpeg cannot execute
JavaScript, evaluate `useCurrentFrame()`, or draw SVG/HTML; Chromium can render a page but
cannot encode/mux a video container. `npx remotion render` (and, in this codebase,
`scripts/render_video.mjs`, invoked from the Next.js API route) orchestrates both in three
stages:

```
React/JSX/SVG/CSS  --[1. Rspack/Webpack]-->  Browser Bundle
Browser Bundle      --[2. Headless Chromium]-->  Frame-by-frame pixel snapshots (0..N)
Frame snapshots + VO audio  --[3. FFmpeg]-->  Final H.264/AAC MP4
```

**Step 1 — Bundling**: the TypeScript/React composition (including every registry motion
component — `StatCard`, `Typewriter`, etc.) is compiled into a web bundle.

**Step 2 — Frame capture**: a headless Chromium instance is spun up. For each discrete frame,
Remotion sets `useCurrentFrame()` to that frame number, evaluates every `interpolate()`/`spring()`
call in the tree, renders the resulting layout, and captures an uncompressed pixel snapshot.
This is precisely why the "every animated property must be a function of frame across the full
duration" rule (locked in after the `StatCard` fix) matters mechanically, not just
stylistically — a property that isn't frame-driven produces identical pixels on every captured
frame past whatever point it stopped being computed.

**Step 3 — Encoding**: captured frames are piped into FFmpeg in real time, muxed with the VO
audio track, and compressed into the final MP4.

This is confirmed as the actual mechanism already running in this project via
`src/app/api/render/route.ts` → `scripts/render_video.mjs`, labeled in the UI as the
"High-Fidelity Remotion Native Renderer" — **not** something to build, something to formally
recognize as the correct/primary path and protect.

## 3. The Actual Current State — Two Paths, One Silent Failure Mode

From `ExportModal.handleStartRender` (`video-generation-frontend`):

```
1. Try POST /api/render (Next.js route → node scripts/render_video.mjs)
     → real Remotion render, per §2. StatCard etc. animate correctly.
2. If that fails (any error, silently caught): fall back to
   POST /jobs/{id}/render on the Python backend
     → pipeline.renderer.engine.VideoRenderer (direct ffmpeg composition)
     → for motion items, calls motion_card.generate_motion_card_image()
     → this produces a SINGLE STATIC IMAGE, not an animated sequence
```

**The problem, precisely**: the Python fallback cannot execute React/interpolate() at all — it
has no Chromium step — so it has no mechanism to fulfill the frame-driven-full-duration rule for
motion components, structurally, not as a bug to patch. If it ever fires (a Remotion script
error, a missing font, an env var issue, anything), the export **silently succeeds** with
frozen/static motion cards — reintroducing the exact "boring StatCard" problem that was already
fixed, with **no indication in the UI of which renderer actually produced the output.** A user
watching the export complete has no way to know a degraded render just happened.

## 4. The Fix

### 4a. Immediate, cheap: make the render engine visible, not silent

Both render paths' responses (`/api/render` and `POST /jobs/{id}/render`) must include which
engine actually produced the output:

```json
{ "status": "complete", "video_url": "...", "render_engine": "remotion-native" }
```
```json
{ "status": "complete", "video_url": "...", "render_engine": "ffmpeg-fallback" }
```

`ExportModal` surfaces this in the completed-export UI — at minimum a visible badge/warning
when `render_engine === "ffmpeg-fallback"` ("Exported without motion animation — Remotion
renderer was unavailable"), so a degraded export is a visible event, not a silent one.

### 4b. Correct, medium-term: the fallback must refuse motion timelines, not degrade them

The Python renderer's fallback role should be scoped to what it's actually capable of doing
correctly: **footage/image/text/audio-only timelines**. It should not be invoked as a full
substitute for the Remotion pipeline. Concretely, `render_timeline()` should inspect the
timeline before rendering:

```python
def render_timeline(timeline: dict, ...):
    has_motion_items = any(
        item.get("assetType") == "motion"
        for track in timeline["tracks"] for item in track["items"]
    )
    if has_motion_items:
        raise RenderEngineMismatchError(
            "This timeline contains motion components that require the Remotion "
            "renderer (headless Chromium + frame-accurate interpolation). The "
            "ffmpeg-only fallback cannot render these correctly and will not "
            "attempt to — fix the primary Remotion render path instead of "
            "silently degrading output."
        )
    # ... existing ffmpeg-based render logic, valid for motion-free timelines only
```

This turns a silent quality regression into a loud, actionable error — the correct failure mode
given the fallback is structurally incapable, not just occasionally worse.

### 4c. Not recommended: "fix" the fallback to also animate

Technically possible (e.g., have the Python backend shell out to the same
`render_video.mjs`/Remotion render itself), but at that point it's not really an independent
fallback anymore — it's the same dependency with extra hops. Not worth building; §4b is the
right scope for what the ffmpeg path should own.

## 5. Success Criteria

1. Every completed export — from either path — reports which `render_engine` actually ran.
2. The export UI visibly distinguishes a full-fidelity Remotion export from a degraded fallback
   one; a user cannot mistake one for the other.
3. A timeline containing any `assetType: "motion"` item, if it ever reaches the Python
   fallback path, fails loudly with a clear error rather than producing a silently-degraded MP4.
4. The Python renderer remains fully functional for its legitimate scope: motion-free
   (footage/image/text/audio only) timelines.
