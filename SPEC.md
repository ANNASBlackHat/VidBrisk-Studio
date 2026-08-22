# SPEC — Frontend (Next.js + Editor)

## 1. Purpose & Scope

Implements the MVP flow already agreed (submit → process → optional checkpoints → editor →
export), consuming the Production Backend API as-is. **No changes to the backend are needed or
in scope here** — this SPEC is purely the frontend's job: screens, state, and the integration
seam into the Remotion-based editor.

**Deliberately out of scope for this phase**: a full visual design system. The editor's UI is
substantially inherited from `designcombo/react-video-editor`; the remaining screens (dashboard,
job creation, progress, approvals) get a functional pass now, a deliberate visual design pass
later once there's a working version to react to — consistent with how every prior phase in
this project was scoped (build the real thing first, polish once it's proven).

## 2. Stack

- **Next.js** (App Router) — forced by the editor choice (Remotion is React-only, and both
  reference editor implementations we evaluated are Next.js apps)
- **`designcombo/react-video-editor`** (or `mohyware/clip-js` as a lighter fallback) as the
  editor base — forked/vendored in, not just linked to
- Communicates with the FastAPI backend over plain HTTP — no GraphQL, no separate BFF layer;
  the backend's job-centric REST API is already the right shape for this

## 3. Screens (mapped 1:1 to the agreed flow)

| # | Screen | Backend calls | Notes |
|---|---|---|---|
| 1 | **Dashboard** | `GET /jobs` *(new — see §6)* | List of past/in-progress jobs, status badge per row, "New Video" 
button |
| 2 | **New Video** | `POST /jobs` | Textarea for raw script/topic. TTS/aligner pickers live behind an "Advanced" toggle, 
defaulting to Kokoro + easytranscriber — not surfaced as a required decision per your note that this isn't a multi-user 
product yet. `auto_approve` toggle, defaulting to **off** for now (see §7) |
| 3 | **Processing** | `GET /jobs/{id}` polled every ~3s | Stage name + a simple progress indicator (7 discrete stages = 
a 7-step progress bar, not a spinner — gives real signal, not just "working…") |
| 4 | **Review Script** *(if not auto_approve)* | `GET /jobs/{id}`, `POST /jobs/{id}/approve` | Beat list, editable text 
per beat, Approve button |
| 5 | **Review Footage** *(if not auto_approve)* | `GET /jobs/{id}`, `POST /jobs/{id}/approve` | Per-beat candidate 
thumbnails (footage or "→ motion fallback" indicator), click to pick a non-default candidate, Approve button |
| 6 | **Editor** | `GET /jobs/{id}/timeline` on load | Full react-video-editor instance, pre-populated (§4) |
| 7 | **Export** | Client-side WASM ffmpeg, or a future server-render endpoint | Download link on completion |

## 4. The Integration Seam: `timeline.json` → Editor State

This is the one piece of real engineering work in this SPEC, worth calling out explicitly
rather than assuming it's free. `react-video-editor` has its **own internal project-state
shape** — it wasn't designed around our schema. A translation layer is required:

```ts
// adapters/timelineToEditorState.ts
function timelineToEditorState(timeline: TimelineJSON): EditorProjectState {
  // maps our tracks[].items[] (video/text/audio/motion) into whatever
  // react-video-editor's internal timeline/track/clip model expects
}
```

This adapter is written **once**, against the real shape of both schemas — worth generating it
by inspecting `react-video-editor`'s actual state types directly rather than guessing, since
this is exactly the kind of detail that's cheap to get right early and annoying to patch later.

**The `assetType: "motion"` items need special handling here**: they don't map to a native
`react-video-editor` clip type (video/image/text) — they need a **custom track-item renderer**
registered with the editor that, given a `componentId` + `props`, renders the actual imported
component (from `lifeprompt-team/remotion-scenes`, `codedbytahir/motionforge`, etc., per the
Component Registry from the backend spec). This is a real editor extension point to build, not
a config toggle — budget real time for it.

## 5. State Management

- **Server state** (job status, timeline data): a data-fetching library with built-in polling
  support (e.g. SWR or React Query) — avoids hand-rolled `setInterval` polling logic, and
  naturally handles "stop polling once `stage=done` or `status=failed`"
- **Editor state** (the live-edited timeline, post-load): owned by `react-video-editor`'s own
  state management once loaded — the adapter in §4 only runs once, at load time; edits after
  that don't round-trip back through our backend schema unless/until an explicit "save draft"
  action is added (not in this MVP — export is the only exit point for now)

## 6. One New Backend Endpoint Needed

The production backend SPEC didn't include a job-listing endpoint (it only specified
per-job reads). The dashboard screen needs one:

```
GET /jobs  →  list of jobs (id, stage, status, created_at, a short label/title)
```

Small addition — flagging it here rather than silently assuming it exists, since it's a gap
in the prior spec, not something to invent unilaterally on the frontend side.

## 7. Note on `auto_approve` Default

Defaulting new jobs to **checkpoints on** (`auto_approve: false`) for this MVP, opposite of
"fully automated" — reasoning: until you've watched a meaningful number of jobs run end-to-end
and trust the pipeline's judgment on beat structure and footage matches, seeing and approving
each stage is more valuable than saving the clicks. Worth revisiting once you have a track
record of runs that didn't need correction — flip the default then, not before.

## 8. Success Criteria for This Phase

1. A job submitted from the New Video screen flows through every stage visibly on the
   Processing screen, matching real backend `stage` transitions — no fake/simulated progress.
2. Both approval screens correctly pause/resume real jobs via the real `awaiting_approval` flow.
3. The editor loads a real compiled `timeline.json` as its **initial, pre-populated state** —
   not an empty project the user builds from scratch.
4. At least one `assetType: "motion"` item renders correctly as an actual visual component in
   the editor, not a placeholder box.
5. A user can trim, swap, and reorder at least one clip and see the change reflected in the
   live preview.
6. Export produces a downloadable MP4 that reflects the user's edits, not just the original
   compiled timeline.

## 9. Deliberately Deferred to a Later Pass

- Full visual/design-system treatment of the non-editor screens
- "Save draft" / re-entering an already-exported project for further edits
- Live/streaming progress (per-beat partial previews during processing) — polling a stage name
  is enough signal for MVP
- Multi-user anything (auth, per-user job lists) — not needed while this is a single-operator tool
