import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Video,
  Audio,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { EditorProjectState, EditorClip } from "@/adapters/timelineToEditorState";
import { getMotionComponent } from "@/components/motion/registry";
import { resolveMediaUrl } from "@/lib/utils";

export interface VideoCompositionProps {
  projectState: EditorProjectState;
}

const FootageClip: React.FC<{
  resolvedUrl: string;
  startFromFrames: number;
  durationFrames: number;
}> = ({ resolvedUrl, startFromFrames, durationFrames }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, durationFrames], [1.0, 1.05], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <Video
        src={resolvedUrl}
        startFrom={startFromFrames}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          scale: `${scale}`,
        }}
        volume={0} // Mute raw footage audio to give full clarity to Voiceover
      />
    </AbsoluteFill>
  );
};

export function VideoComposition({ projectState }: VideoCompositionProps) {
  const { fps } = useVideoConfig();

  const videoTrack = projectState.tracks.find((t) => t.id === "video");
  const textTrack = projectState.tracks.find((t) => t.id === "text");
  const audioTrack = projectState.tracks.find((t) => t.id === "audio");

  const renderVideoItem = (item: EditorClip) => {
    const fromFrame = Math.max(0, Math.round(item.trackStart * fps));
    const durationFrames = Math.max(1, Math.round(item.duration * fps));

    if (item.assetType === "motion") {
      const MotionComp = getMotionComponent(item.componentId);
      return (
        <Sequence
          key={item.id}
          from={fromFrame}
          durationInFrames={durationFrames}
          name={item.id}
        >
          <AbsoluteFill>
            <MotionComp
              {...(item.props || {})}
              durationInFrames={durationFrames}
              text={
                typeof item.props?.text === "string"
                  ? item.props.text
                  : item.rawContent || item.content
              }
            />
          </AbsoluteFill>
        </Sequence>
      );
    }

    // Video / Footage Clip
    const rawUrl = item.storageUrl || item.storagePath;
    const resolvedUrl = resolveMediaUrl(rawUrl);
    const startFromFrames = Math.max(0, Math.round((item.sourceIn || 0) * fps));

    if (!resolvedUrl) {
      return (
        <Sequence
          key={item.id}
          from={fromFrame}
          durationInFrames={durationFrames}
          name={item.id}
        >
          <AbsoluteFill style={{ backgroundColor: "#0f172a", justifyContent: "center", alignItems: "center" }}>
            <span className="text-slate-400 font-mono text-sm">No footage media source</span>
          </AbsoluteFill>
        </Sequence>
      );
    }

    return (
      <Sequence
        key={item.id}
        from={fromFrame}
        durationInFrames={durationFrames}
        name={item.id}
      >
        <FootageClip
          resolvedUrl={resolvedUrl}
          startFromFrames={startFromFrames}
          durationFrames={durationFrames}
        />
      </Sequence>
    );
  };

  const renderTextItem = (item: EditorClip) => {
    const fromFrame = Math.max(0, Math.round(item.trackStart * fps));
    const durationFrames = Math.max(1, Math.round(item.duration * fps));

    if (!item.content) return null;

    return (
      <Sequence
        key={item.id}
        from={fromFrame}
        durationInFrames={durationFrames}
        name={item.id}
      >
        <AbsoluteFill
          style={{
            justifyContent: "flex-end",
            alignItems: "center",
            paddingBottom: 48,
            pointerEvents: "none",
          }}
        >
          <div className="px-6 py-3 rounded-2xl bg-black/85 backdrop-blur-md border border-white/10 text-white text-base sm:text-xl font-medium text-center max-w-3xl shadow-2xl">
            {item.content}
          </div>
        </AbsoluteFill>
      </Sequence>
    );
  };

  const renderAudioItem = (item: EditorClip) => {
    const fromFrame = Math.max(0, Math.round(item.trackStart * fps));
    const durationFrames = Math.max(1, Math.round(item.duration * fps));
    const rawAudioUrl = item.assetId || item.storageUrl || item.storagePath;
    const resolvedAudioUrl = resolveMediaUrl(rawAudioUrl);

    if (!resolvedAudioUrl) return null;

    return (
      <Sequence
        key={item.id}
        from={fromFrame}
        durationInFrames={durationFrames}
        name={item.id}
      >
        <Audio src={resolvedAudioUrl} volume={1} />
      </Sequence>
    );
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#090d16", overflow: "hidden" }}>
      {/* 1. Video & Motion Track Layer */}
      {videoTrack?.items.map((item) => renderVideoItem(item))}

      {/* 2. Text / Captions Overlay Layer */}
      {textTrack?.items.map((item) => renderTextItem(item))}

      {/* 3. Audio Voiceover Track Layer */}
      {audioTrack?.items.map((item) => renderAudioItem(item))}
    </AbsoluteFill>
  );
}
