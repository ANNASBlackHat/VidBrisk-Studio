import {
  TimelineJSON,
  VideoTrackItem,
  TextTrackItem,
  AudioTrackItem,
  FootageCandidate,
  TargetOrientation,
} from "@/lib/types";

export interface EditorClip {
  id: string;
  trackId: "video" | "text" | "audio";
  trackStart: number; // in seconds
  trackEnd: number; // in seconds
  duration: number; // in seconds

  // Video / Motion specific
  assetType?: "video" | "image" | "motion";
  assetId?: string;
  sourceIn?: number;
  sourceOut?: number;
  storagePath?: string;
  storageUrl?: string;
  componentId?: string;
  props?: Record<string, unknown>;
  rawContent?: string;
  style?: string;

  // Text specific
  content?: string;

  // Metadata & Alternative Candidates
  beatId?: string;
  candidates?: FootageCandidate[];
}

export interface EditorTrack {
  id: "video" | "text" | "audio";
  label: string;
  type: "video" | "text" | "audio";
  items: EditorClip[];
}

export interface EditorProjectState {
  jobId: string;
  fps: number;
  totalDuration: number; // in seconds
  width: number;
  height: number;
  orientation: TargetOrientation;
  tracks: EditorTrack[];
  selectedClipId: string | null;
  metadata?: {
    beat_count?: number;
    footage_candidates?: Record<string, FootageCandidate[]>;
  };
}

export function getResolutionForOrientation(orientation: TargetOrientation = "horizontal"): {
  width: number;
  height: number;
} {
  switch (orientation) {
    case "vertical":
      return { width: 1080, height: 1920 };
    case "square":
      return { width: 1080, height: 1080 };
    default:
      return { width: 1920, height: 1080 };
  }
}

/**
 * Translates backend `timeline.json` into the Remotion Editor state.
 */
export function timelineToEditorState(
  timeline: TimelineJSON,
  orientation: TargetOrientation = "horizontal",
  jobId: string = "job"
): EditorProjectState {
  const fps = 30;
  const totalDuration = timeline.total_duration || 10;
  const { width, height } = getResolutionForOrientation(orientation);

  const videoItems: EditorClip[] = [];
  const textItems: EditorClip[] = [];
  const audioItems: EditorClip[] = [];

  const candidatesMap = timeline.metadata?.footage_candidates || {};

  for (const track of timeline.tracks || []) {
    if (track.type === "video") {
      for (const rawItem of track.items || []) {
        const item = rawItem as VideoTrackItem;
        const dur = Math.max(0.1, (item.trackEnd || 0) - (item.trackStart || 0));
        
        // Extract beatId e.g. from id 'clip_b1' or 'b1_motion'
        const match = item.id.match(/b\d+/);
        const beatId = match ? match[0] : undefined;
        const beatCandidates = beatId ? candidatesMap[beatId] : undefined;

        videoItems.push({
          id: item.id,
          trackId: "video",
          trackStart: item.trackStart || 0,
          trackEnd: item.trackEnd || (item.trackStart || 0) + dur,
          duration: dur,
          assetType: item.assetType || "video",
          assetId: item.assetId,
          sourceIn: item.sourceIn || 0,
          sourceOut: item.sourceOut || dur,
          storagePath: item.storagePath,
          storageUrl: item.storageUrl || item.storagePath,
          componentId: item.componentId,
          props: item.props || {},
          rawContent: item.rawContent,
          style: item.style,
          beatId,
          candidates: beatCandidates,
        });
      }
    } else if (track.type === "text") {
      for (const rawItem of track.items || []) {
        const item = rawItem as TextTrackItem;
        const dur = Math.max(0.1, (item.trackEnd || 0) - (item.trackStart || 0));

        // Check if there is already a video clip covering this time segment
        const hasOverlappingVideo = videoItems.some(
          (v) =>
            v.assetType === "video" &&
            Math.max(v.trackStart, item.trackStart || 0) <
              Math.min(v.trackEnd, item.trackEnd || 0) - 0.2
        );

        const isMotionCard =
          !hasOverlappingVideo ||
          item.style === "stat-callout" ||
          item.style === "abstract-card" ||
          item.id.includes("motion") ||
          Boolean(item.componentId);

        if (isMotionCard) {
          // Promote to Motion Component in visual track
          const componentId = item.componentId || (
            item.style === "stat-callout" ||
            item.content?.includes("$") ||
            item.content?.includes("%") ||
            /\d+/.test(item.content || "")
              ? "DataAnimations/StatCard"
              : "TextAnimations/QuoteCard"
          );

          let props: Record<string, unknown> = {
            ...(item.props || {}),
            mode: hasOverlappingVideo ? "overlay" : "takeover",
            durationInFrames: Math.max(30, Math.round(dur * fps)),
          };

          if (componentId === "DataAnimations/StatCard") {
            const match = item.content?.match(
              /(\$?\d+(?:\.\d+)?\s*(?:billion|million|thousand|percent|%|k|m|b)?|\d+%)/i
            );
            const val = match ? match[1].toUpperCase() : "$25.4B";
            const isPercent = val.includes("%") || (item.content || "").toLowerCase().includes("percent");
            props = {
              primary_value: val,
              kicker: isPercent ? "BUDGET ALLOCATION SHARE" : "PROGRAM INVESTMENT",
              visual_type: isPercent ? "ring" : "chart",
              subtext: item.content,
              themeColor: "#38bdf8",
              ...props,
            };
          } else if (componentId === "TextAnimations/QuoteCard") {
            props = {
              quote: item.content,
              emphasis: "the impossible was within reach",
              author: "Historic Transmission",
              ...props,
            };
          }

          videoItems.push({
            id: item.id.replace("txt_", "motion_"),
            trackId: "video",
            trackStart: item.trackStart || 0,
            trackEnd: item.trackEnd || (item.trackStart || 0) + dur,
            duration: dur,
            assetType: "motion",
            componentId,
            props,
            rawContent: item.content,
            style: item.style,
          });
        } else {
          textItems.push({
            id: item.id,
            trackId: "text",
            trackStart: item.trackStart || 0,
            trackEnd: item.trackEnd || (item.trackStart || 0) + dur,
            duration: dur,
            content: item.content,
            style: item.style,
          });
        }
      }
    } else if (track.type === "audio") {
      for (const rawItem of track.items || []) {
        const item = rawItem as AudioTrackItem;
        const dur = Math.max(0.1, (item.trackEnd || 0) - (item.trackStart || 0));
        audioItems.push({
          id: item.id,
          trackId: "audio",
          trackStart: item.trackStart || 0,
          trackEnd: item.trackEnd || (item.trackStart || 0) + dur,
          duration: dur,
          assetId: item.assetId,
        });
      }
    }
  }

  // Sort track items by start time
  videoItems.sort((a, b) => a.trackStart - b.trackStart);
  textItems.sort((a, b) => a.trackStart - b.trackStart);
  audioItems.sort((a, b) => a.trackStart - b.trackStart);

  const tracks: EditorTrack[] = [
    {
      id: "video",
      label: "Visuals & Motion Graphics",
      type: "video",
      items: videoItems,
    },
    {
      id: "text",
      label: "Captions & Titles",
      type: "text",
      items: textItems,
    },
    {
      id: "audio",
      label: "Voiceover Track",
      type: "audio",
      items: audioItems,
    },
  ];

  return {
    jobId,
    fps,
    totalDuration,
    width,
    height,
    orientation,
    tracks,
    selectedClipId: videoItems[0]?.id || null,
    metadata: timeline.metadata,
  };
}

/**
 * Converts internal EditorProjectState back to TimelineJSON for rendering.
 */
export function editorStateToTimeline(state: EditorProjectState): TimelineJSON {
  const videoTrack = state.tracks.find((t) => t.id === "video");
  const textTrack = state.tracks.find((t) => t.id === "text");
  const audioTrack = state.tracks.find((t) => t.id === "audio");

  const videoItems: VideoTrackItem[] = (videoTrack?.items || []).map((item) => ({
    id: item.id,
    trackStart: item.trackStart,
    trackEnd: item.trackEnd,
    assetId: item.assetId,
    sourceIn: item.sourceIn,
    sourceOut: item.sourceOut,
    assetType: item.assetType || "video",
    storagePath: item.storagePath,
    storageUrl: item.storageUrl,
    componentId: item.componentId,
    props: item.props,
    rawContent: item.rawContent,
    style: item.style,
  }));

  const textItems: TextTrackItem[] = (textTrack?.items || []).map((item) => ({
    id: item.id,
    trackStart: item.trackStart,
    trackEnd: item.trackEnd,
    content: item.content || "",
    style: item.style,
  }));

  const audioItems: AudioTrackItem[] = (audioTrack?.items || []).map((item) => ({
    id: item.id,
    trackStart: item.trackStart,
    trackEnd: item.trackEnd,
    assetId: item.assetId || item.storagePath || item.storageUrl || "",
  }));

  return {
    tracks: [
      {
        type: "video",
        items: videoItems,
      },
      {
        type: "text",
        items: textItems,
      },
      {
        type: "audio",
        items: audioItems,
      },
    ],
    total_duration: state.totalDuration,
    metadata: state.metadata,
  };
}
