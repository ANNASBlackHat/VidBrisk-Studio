import {
  TimelineJSON,
  VideoTrackItem,
  TextTrackItem,
  AudioTrackItem,
  FootageCandidate,
  TargetOrientation,
  TransitionStyle,
  Layer,
  LayoutRole,
  WordTiming,
  FootageEffects,
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
  effects?: FootageEffects;

  // Text specific
  content?: string;

  // Multi-layer composition
  zIndex?: number;
  layoutRole?: LayoutRole;

  // Metadata, Timings & Alternative Candidates
  beatId?: string;
  timings?: WordTiming[];
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
  transitionStyle?: TransitionStyle;
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

  // Build beatId -> WordTiming[] and beatId -> Layer[] lookup from timeline.metadata.resolved_beats
  const resolvedBeats = timeline.metadata?.resolved_beats || [];
  const timingsByBeat = new Map<string, WordTiming[]>();
  const layersByBeat = new Map<string, Layer[]>();
  for (const rb of resolvedBeats) {
    if (rb.beat?.id && rb.timings && rb.timings.length > 0) {
      timingsByBeat.set(rb.beat.id, rb.timings);
    }
    const layers = rb.asset_plan?.layers;
    if (rb.beat?.id && layers && layers.length > 0) {
      layersByBeat.set(rb.beat.id, layers);
    }
  }

  // Each beat's on-timeline window, derived from its own track items so
  // layer-based clips can be placed at the right time. Falls back to
  // cumulative voice_clip durations when no track items reference the beat.
  const beatWindows = new Map<string, { start: number; end: number }>();
  if (layersByBeat.size > 0) {
    const expandWindow = (
      beatId: string | undefined,
      start?: number,
      end?: number
    ) => {
      if (!beatId || !layersByBeat.has(beatId)) return;
      if (start == null || end == null) return;
      const w = beatWindows.get(beatId);
      beatWindows.set(beatId, {
        start: Math.min(w?.start ?? start, start),
        end: Math.max(w?.end ?? end, end),
      });
    };

    for (const track of timeline.tracks || []) {
      for (const rawItem of track.items || []) {
        const anyItem = rawItem as VideoTrackItem;
        expandWindow(
          anyItem.id.match(/b\d+/)?.[0],
          anyItem.trackStart,
          anyItem.trackEnd
        );
      }
    }

    let cursor = 0;
    for (const rb of resolvedBeats) {
      const beatId = rb.beat?.id;
      const dur = Math.max(0.1, rb.voice_clip?.duration_sec || 0);
      if (!beatId || !layersByBeat.has(beatId)) {
        cursor += dur;
        continue;
      }
      if (!beatWindows.has(beatId) && rb.voice_clip?.duration_sec) {
        beatWindows.set(beatId, { start: cursor, end: cursor + dur });
      }
      cursor += dur;
    }
  }

  const layerAssetType = (type: Layer["type"]): "video" | "image" | "motion" =>
    type === "video" ? "video" : type === "image" ? "image" : "motion";

  const pushLayerClips = (beatId: string): boolean => {
    const layers = layersByBeat.get(beatId);
    const window = beatWindows.get(beatId);
    if (!layers || !window || window.end - window.start <= 0) return false;

    const dur = Math.max(0.1, window.end - window.start);
    [...layers]
      .sort((a, b) => a.z - b.z)
      .forEach((layer, i) => {
        videoItems.push({
          id: `${beatId}_layer${i}`,
          trackId: "video",
          trackStart: window.start,
          trackEnd: window.end,
          duration: dur,
          assetType: layerAssetType(layer.type),
          sourceIn: layer.sourceIn ?? 0,
          sourceOut: layer.sourceOut ?? dur,
          storagePath: layer.storagePath,
          storageUrl: layer.storageUrl || layer.storagePath,
          componentId: layer.componentId,
          props: layer.props || {},
          rawContent: layer.content,
          style: layer.style,
          content: layer.content,
          zIndex: layer.z,
          layoutRole: layer.layout,
          beatId,
          candidates: candidatesMap[beatId],
          timings: timingsByBeat.get(beatId),
          effects: (layer.props?.effects as FootageEffects | undefined) || undefined,
        });
      });
    return true;
  };
  // --------------------------------------------------------------------------

  for (const track of timeline.tracks || []) {
    if (track.type === "video") {
      for (const rawItem of track.items || []) {
        const item = rawItem as VideoTrackItem;
        const dur = Math.max(0.1, (item.trackEnd || 0) - (item.trackStart || 0));
        
        // Extract beatId e.g. from id 'clip_b1' or 'b1_motion'
        const match = item.id.match(/b\d+/);
        const beatId = match ? match[0] : undefined;

        // Layered beats are fully described by their layers[] — skip the
        // original flat items to avoid duplicate rendering.
        if (beatId && layersByBeat.has(beatId)) continue;

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
          zIndex: item.zIndex,
          beatId,
          candidates: beatCandidates,
          timings: beatId ? timingsByBeat.get(beatId) : undefined,
          effects: (item.props?.effects as FootageEffects | undefined) || undefined,
        });
      }
    } else if (track.type === "text") {
      for (const rawItem of track.items || []) {
        const item = rawItem as TextTrackItem;
        const dur = Math.max(0.1, (item.trackEnd || 0) - (item.trackStart || 0));

        // Layered beats bypass the overlap/regex promotion heuristics —
        // their text layers are emitted directly from asset_plan.layers.
        const textBeatId = item.id.match(/b\d+/)?.[0];
        if (textBeatId && layersByBeat.has(textBeatId)) continue;
        const beatTimings = textBeatId ? timingsByBeat.get(textBeatId) : undefined;

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
            beatId: textBeatId,
            timings: beatTimings,
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
            beatId: textBeatId,
            timings: beatTimings,
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

  // Emit layer-based clips for layered beats (after legacy items so that
  // any beat without a derivable window keeps its legacy clips untouched).
  for (const beatId of Array.from(layersByBeat.keys())) {
    pushLayerClips(beatId);
  }

  // Sort by start time; ties broken by zIndex (render order = stacking order).
  const zOf = (c: EditorClip) => (c.zIndex == null ? Number.MAX_SAFE_INTEGER : c.zIndex);
  videoItems.sort((a, b) => a.trackStart - b.trackStart || zOf(a) - zOf(b));
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
    transitionStyle: (timeline.metadata as { transition_style?: TransitionStyle })?.transition_style || "none",
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
    zIndex: item.zIndex,
    layoutRole: item.layoutRole,
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
    metadata: {
      ...(state.metadata || {}),
      transition_style: state.transitionStyle || "none",
    },
  };
}
