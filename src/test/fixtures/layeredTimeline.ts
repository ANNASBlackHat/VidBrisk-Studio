import { TimelineJSON } from "@/lib/types";

/**
 * Layered timeline: b1 is a split_screen beat (two footage layers),
 * b2 is stat_over_footage (footage + StatCard overlay).
 */
export function makeLayeredTimeline(): TimelineJSON {
  return {
    tracks: [
      {
        type: "video",
        items: [
          // Flat items still present for b1/b2 — must be superseded by layers
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
          // Would be regex-promoted to a motion card in the legacy path —
          // must be skipped because b2 carries explicit layers.
          {
            id: "txt_b2_stat",
            trackStart: 4,
            trackEnd: 8,
            content: "$25.4 billion invested",
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
      job_id: "job_layered",
      beat_count: 2,
      footage_candidates: {
        b1: [
          {
            chunk_id: "c9",
            source_in: 0,
            source_out: 4,
            duration: 4,
            storage_url: "http://media.local/footage_c.mp4",
          },
        ],
      },
      resolved_beats: [
        {
          beat: {
            id: "b1",
            text: "Two perspectives on the grid",
            visual_intent: "split screen comparison",
            beat_type: "narrative",
          },
          voice_clip: { beat_id: "b1", audio_path: "voice_b1.wav", duration_sec: 4 },
          asset_plan: {
            strategy: "split_screen",
            items: [],
            layers: [
              {
                role: "background",
                z: 0,
                type: "video",
                layout: "split-left",
                chunkId: "c_left",
                sourceIn: 10,
                sourceOut: 14,
                storageUrl: "http://media.local/split_left.mp4",
              },
              {
                role: "background",
                z: 1,
                type: "video",
                layout: "split-right",
                chunkId: "c_right",
                sourceIn: 20,
                sourceOut: 24,
                storageUrl: "http://media.local/split_right.mp4",
              },
            ],
          },
        },
        {
          beat: {
            id: "b2",
            text: "$25.4 billion invested",
            visual_intent: "stat over footage",
            beat_type: "stat",
          },
          voice_clip: { beat_id: "b2", audio_path: "voice_b2.wav", duration_sec: 4 },
          asset_plan: {
            strategy: "motion_text",
            items: [],
            layers: [
              {
                role: "background",
                z: 0,
                type: "video",
                layout: "full",
                sourceIn: 0,
                sourceOut: 4,
                storageUrl: "http://media.local/footage_b.mp4",
              },
              {
                role: "overlay",
                z: 1,
                type: "motion",
                layout: "overlay-lower-third",
                componentId: "DataAnimations/StatCard",
                content: "$25.4B invested",
                props: { primary_value: "$25.4B" },
              },
            ],
          },
        },
      ],
    },
  };
}
