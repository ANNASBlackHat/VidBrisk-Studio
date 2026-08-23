import { TimelineJSON } from "@/lib/types";

/**
 * Legacy timeline shape (no asset_plan.layers anywhere) — must keep flowing
 * through the original overlap/regex heuristic path byte-for-byte.
 */
export function makeLegacyTimeline(): TimelineJSON {
  return {
    tracks: [
      {
        type: "video",
        items: [
          {
            id: "clip_b1",
            trackStart: 0,
            trackEnd: 4,
            assetType: "video",
            sourceIn: 10,
            sourceOut: 14,
            storageUrl: "http://media.local/footage_a.mp4",
          },
          {
            id: "clip_b2",
            trackStart: 4,
            trackEnd: 8,
            assetType: "video",
            sourceIn: 0,
            sourceOut: 4,
            storageUrl: "http://media.local/footage_b.mp4",
          },
        ],
      },
      {
        type: "text",
        items: [
          // Overlaps clip_b1 and has no motion markers → plain caption
          {
            id: "txt_b1_caption",
            trackStart: 1,
            trackEnd: 3.5,
            content: "A quiet revolution in energy",
            style: "caption",
          },
          // No overlapping video, contains "$" → promoted to StatCard takeover
          {
            id: "txt_b2_stat",
            trackStart: 4,
            trackEnd: 8,
            content: "The grid absorbed $25.4 billion in upgrades",
            style: "stat-callout",
          },
        ],
      },
      {
        type: "audio",
        items: [
          {
            id: "vo_b1",
            trackStart: 0,
            trackEnd: 4,
            assetId: "http://media.local/voice_b1.wav",
          },
          {
            id: "vo_b2",
            trackStart: 4,
            trackEnd: 8,
            assetId: "http://media.local/voice_b2.wav",
          },
        ],
      },
    ],
    total_duration: 8,
    metadata: {
      job_id: "job_legacy",
      beat_count: 2,
      footage_candidates: {
        b1: [
          {
            chunk_id: "c1",
            source_in: 10,
            source_out: 14,
            duration: 4,
            storage_url: "http://media.local/footage_a_alt.mp4",
          },
        ],
      },
      resolved_beats: [
        {
          beat: {
            id: "b1",
            text: "A quiet revolution in energy",
            visual_intent: "footage of transmission lines",
            beat_type: "narrative",
          },
          voice_clip: { beat_id: "b1", audio_path: "voice_b1.wav", duration_sec: 4 },
        },
        {
          beat: {
            id: "b2",
            text: "The grid absorbed $25.4 billion in upgrades",
            visual_intent: "stat card over footage",
            beat_type: "stat",
          },
          voice_clip: { beat_id: "b2", audio_path: "voice_b2.wav", duration_sec: 4 },
        },
      ],
    },
  };
}
