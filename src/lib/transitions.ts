import { EditorClip } from "@/adapters/timelineToEditorState";

export interface StreamBoundary {
  a: EditorClip;
  b: EditorClip;
  boundaryFrame: number;
}

const EPSILON = 0.05; // 50ms tolerance for contiguous cuts

/**
 * Normalizes the stream key for a clip to separate background streams from overlay streams.
 * Full-bleed clips (undefined or 'full' layoutRole) at default z-index share the 'base#0' stream.
 */
export function normalizeStreamKey(item: EditorClip): string {
  const role = item.layoutRole === "full" || !item.layoutRole ? "base" : item.layoutRole;
  const z = item.zIndex ?? 0;
  return `${role}#${z}`;
}

/**
 * Identifies contiguous (non-overlapping, back-to-back) clip pairs within the same layer stream.
 * Gapped intervals or layered overlapping clips are excluded.
 */
export function getStreamBoundaries(
  items: EditorClip[] = [],
  fps: number = 30
): StreamBoundary[] {
  if (!items || items.length < 2) {
    return [];
  }

  // 1. Group items by stream key
  const streams = new Map<string, EditorClip[]>();
  for (const item of items) {
    const key = normalizeStreamKey(item);
    const list = streams.get(key) || [];
    list.push(item);
    streams.set(key, list);
  }

  const boundaries: StreamBoundary[] = [];

  // 2. For each stream, sort by trackStart and find contiguous pairs
  streams.forEach((group) => {
    const sorted = [...group].sort((a, b) => a.trackStart - b.trackStart);

    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];

      // Check if contiguous cut (distance between a's end and b's start is within EPSILON)
      if (Math.abs(a.trackEnd - b.trackStart) < EPSILON) {
        boundaries.push({
          a,
          b,
          boundaryFrame: Math.round(b.trackStart * fps),
        });
      }
    }
  });

  // Sort all boundaries chronologically by boundaryFrame
  return boundaries.sort((x, y) => x.boundaryFrame - y.boundaryFrame);
}
