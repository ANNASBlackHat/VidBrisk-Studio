# SPEC: List-Reveal Components — Frontend (Card Swipe Deck + Chat Bubble Reveal)
**Project:** video-generation-frontend
**Status:** Draft
**Depends on / pairs with:** `SPEC_backend_list_reveal_components.md` (for the `items`/`messages` prop data)

## 1. Overview
Two new motion components, following the exact contract established by `StatCard`/`QuoteCard`/`KineticText`: declare supported `LayoutRole`s, register in `MOTION_COMPONENTS`, componentId strings matching the backend's `ComponentRegistry` exactly.
- **`SwipeDeck`** (`ListAnimations/SwipeDeck`) — stacked cards, each showing one short item, swiping away to reveal the next.
- **`ChatBubbles`** (`ListAnimations/ChatBubbles`) — alternating message bubbles building up in sequence, iMessage/WhatsApp-style.

## 2. Current State (verified in codebase)
- `src/components/motion/registry.ts` — `MOTION_COMPONENTS` map, `BaseMotionProps` (`durationInFrames`, `text`, `layoutRole`), `getMotionComponent()` exact/partial-match resolver. Each component exports a `X_SUPPORTED_ROLES` array (e.g. `SPLIT_SCREEN_SUPPORTED_ROLES`, `KINETIC_TEXT_SUPPORTED_ROLES`) — new components must follow this.
- `StatCard.tsx` / `KineticText.tsx` establish the choreography convention: entrance spring (`damping: 14, mass: 0.6, stiffness: 95`), phase timing as fractions of `totalFrames` (e.g. `entranceEnd = totalFrames * 0.15`), soft exit in the final ~12%.
- Backend will emit `props.items: string[]` for `SwipeDeck` and `props.messages: Array<{text, sender}>` for `ChatBubbles` (see backend spec §4).

## 3. Goals
- Build both components following the established entrance/exit choreography and `layoutRole` contract.
- Both should support `"full"`/`"takeover"` (their primary use) and gracefully degrade for `"overlay-lower-third"` (smaller footprint, fewer visible items at once) — not every `layoutRole` needs to be beautiful, but none should break.
- Register both in `MOTION_COMPONENTS` with componentIds matching the backend exactly.

## Non-Goals
- Not building drag/swipe *interactivity* — this is a rendered video, "swipe" is a purely visual animation (cards translate/rotate off-screen on a timer), not a user-input gesture.
- Not handling arbitrarily long item lists — backend caps at 5 items; frontend can assume ≤5 and doesn't need scroll/overflow handling.

## 4. Component Design

### `SwipeDeck` (`src/components/motion/SwipeDeck.tsx`)
```typescript
export interface SwipeDeckProps {
  items?: string[];
  durationInFrames?: number;
  layoutRole?: LayoutRole;
  themeColor?: string;
  text?: string;   // fallback: single-item deck if items absent
}
export const SWIPE_DECK_SUPPORTED_ROLES: LayoutRole[] = ["full", "takeover", "overlay-lower-third"];
```
- Divide `totalFrames` evenly across `items.length` (min 1), each item's "slot" gets: entrance (spring scale+opacity, slightly rotated per stacking-deck convention — top card at `rotate(0deg)`, cards beneath at `rotate(±3deg)` peeking out from behind), a hold period, then an exit (`translateX` + `rotate` off-screen, matching a physical card-swipe direction, alternating left/right per card for visual variety).
- Cards beneath the active one render at reduced opacity/scale (simple `AbsoluteFill` stacking, z-index by remaining-items order) to sell the "deck" look without needing real 3D.
- Fallback: if `items` is absent/empty, use `text` as a single-card deck (never render blank).

### `ChatBubbles` (`src/components/motion/ChatBubbles.tsx`)
```typescript
export interface ChatBubblesProps {
  messages?: Array<{ text: string; sender?: "system" | "user" }>;
  durationInFrames?: number;
  layoutRole?: LayoutRole;
  text?: string;   // fallback: single bubble if messages absent
}
export const CHAT_BUBBLES_SUPPORTED_ROLES: LayoutRole[] = ["full", "takeover", "overlay-lower-third"];
```
- Bubbles accumulate (previous ones stay visible, pushed up) rather than replacing each other — closer to a real chat thread than the swipe deck's replace-and-discard model. Each new bubble's entrance staggered by `totalFrames / messages.length`, `spring()` scale-in from the message's side (`sender === "system"` → left-aligned, `"user"` → right-aligned, standard chat-bubble styling: rounded corners, tail-less is fine for simplicity).
- Cap visible bubbles at once (e.g. last 4) if `messages.length` could exceed comfortable vertical space — backend caps at 5, so this is a soft safety net, not a hard requirement.
- Fallback: `text` as single system bubble if `messages` absent.

## 5. Implementation Plan
1. Build `SwipeDeck.tsx` — entrance/hold/exit per card, stacked-deck peek effect.
2. Build `ChatBubbles.tsx` — accumulating staggered bubble entrance, sender-based alignment.
3. Register both in `src/components/motion/registry.ts`: add to `MOTION_COMPONENTS` (`"ListAnimations/SwipeDeck"`, `"ListAnimations/ChatBubbles"`), add to `MotionComponentProps` union, export types/supported-roles arrays matching the existing pattern exactly.
4. Manual QA in Remotion Studio / `MotionGallery.tsx` (already used for component preview per `renderSelectedComponent`) with both real backend-generated `items`/`messages` data and the text-only fallback path.

## 6. Testing
- Component test: `SwipeDeck` with 1, 3, and 5 items — confirm correct number of card slots, no overlap/timing errors at boundary frames.
- Component test: `ChatBubbles` alternating senders — confirm left/right alignment matches `sender`.
- Fallback test: both components render correctly with only `text` provided (no `items`/`messages`).
- Registry test: `getMotionComponent("ListAnimations/SwipeDeck")` and `getMotionComponent("ListAnimations/ChatBubbles")` resolve correctly, including the existing partial-match fallback path.

## 7. Open Questions
- Should `SwipeDeck`'s swipe direction be randomized per card or deterministically alternating? Recommend deterministic alternating (left/right/left/right) — fully random risks looking chaotic rather than intentional at this small item count.
- Chat bubble timestamps or "typing indicator" pauses between messages — nice authenticity touch, but adds complexity. Recommend skipping for v1, revisit only if the plain staggered-entrance version reads as too flat.

## 8. Acceptance Criteria
- [ ] `SwipeDeck` and `ChatBubbles` render correctly with real backend data (`items`/`messages`) and with fallback `text`.
- [ ] Both registered in `MOTION_COMPONENTS` with componentIds exactly matching the backend's `ComponentRegistry` entries.
- [ ] Both declare and reasonably support `"full"`, `"takeover"`, and `"overlay-lower-third"` layout roles.
- [ ] No regressions to `getMotionComponent`'s existing resolution logic or other registered components.
