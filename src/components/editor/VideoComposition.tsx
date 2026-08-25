import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Video,
  OffthreadVideo,
  Audio,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { EditorProjectState, EditorClip } from "@/adapters/timelineToEditorState";
import { getMotionComponent } from "@/components/motion/registry";
import { FlashTransition } from "@/components/motion/FlashTransition";
import { GlitchTransition } from "@/components/motion/GlitchTransition";
import { getStreamBoundaries } from "@/lib/transitions";
import { LayoutRole, ColorTreatment, FootageEffects, ClipTransitionKind } from "@/lib/types";
import { resolveMediaUrl } from "@/lib/utils";
import { noise2D } from "@remotion/noise";

export interface VideoCompositionProps {
  projectState: EditorProjectState;
}

/**
 * Maps a ColorTreatment enum value to its corresponding CSS filter string.
 */
export function getColorTreatmentFilter(treatment?: ColorTreatment): string | undefined {
  switch (treatment) {
    case "duotone-cool":
      return "grayscale(1) contrast(1.1) sepia(0.3) hue-rotate(180deg) saturate(1.4)";
    case "duotone-warm":
      return "grayscale(1) contrast(1.1) sepia(0.3) hue-rotate(-20deg) saturate(1.4)";
    case "duotone-mono":
      return "grayscale(1) contrast(1.15)";
    case "none":
    default:
      return undefined;
  }
}

/**
 * Roles that float above base footage: rendered transparently with pointer
 * events disabled so editor clicks reach the layer beneath.
 */
const OVERLAY_ROLES: LayoutRole[] = [
  "overlay-lower-third",
  "corner-tl",
  "corner-tr",
  "corner-bl",
  "corner-br",
];

const isOverlayRole = (item: EditorClip): boolean =>
  item.layoutRole ? OVERLAY_ROLES.includes(item.layoutRole) : false;

/**
 * Geometry applied by the composition to non-motion layers (raw footage has
 * no layout concept of its own). Motion components consume `layoutRole`
 * directly and position themselves.
 *
 * Every mapping must explicitly neutralize opposing edges ("auto") because
 * these styles are merged OVER AbsoluteFill's default `inset: 0`.
 */
export const layerGeometry = (role?: LayoutRole): React.CSSProperties => {
  switch (role) {
    case "split-left":
      return { position: "absolute", top: 0, bottom: 0, left: 0, right: "auto", width: "50%", height: "auto" };
    case "split-right":
      return { position: "absolute", top: 0, bottom: 0, left: "auto", right: 0, width: "50%", height: "auto" };
    case "corner-tl":
      return { position: "absolute", left: "4%", top: "6%", right: "auto", bottom: "auto", width: "30%", height: "30%" };
    case "corner-tr":
      return { position: "absolute", right: "4%", top: "6%", left: "auto", bottom: "auto", width: "30%", height: "30%" };
    case "corner-bl":
      return { position: "absolute", left: "4%", bottom: "6%", right: "auto", top: "auto", width: "30%", height: "30%" };
    case "corner-br":
      return { position: "absolute", right: "4%", bottom: "6%", left: "auto", top: "auto", width: "30%", height: "30%" };
    case "overlay-lower-third":
      return { position: "absolute", left: 0, right: 0, bottom: 0, top: "auto", height: "34%", width: "auto" };
    default:
      // "full" / "takeover" / undefined — opaque full-bleed
      return {};
  }
};

export interface FootageClipProps {
  resolvedUrl: string;
  startFromFrames: number;
  durationFrames: number;
  containerStyle?: React.CSSProperties;
  effects?: FootageEffects;
  exitTransition?: ClipTransitionKind;
  enterTransition?: ClipTransitionKind;
}

export const FootageClip: React.FC<FootageClipProps> = ({
  resolvedUrl,
  startFromFrames,
  durationFrames,
  containerStyle,
  effects,
  exitTransition,
  enterTransition,
}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, durationFrames], [1.0, 1.05], {
    extrapolateRight: "clamp",
  });

  const transitionFrames = Math.min(8, Math.max(1, Math.floor(durationFrames / 2)));
  let translateX = 0;
  let translateY = 0;
  let rotateDeg = 0;
  let blurPx = 0;

  // Shake: noise-driven jitter decaying to 0, composed with Ken-Burns scale
  const shakeWindow = Math.min(8, Math.max(1, Math.floor(durationFrames * 0.2)));
  const shakeDecay = (f: number, window: number) => interpolate(f, [0, window], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (enterTransition === "shake" && frame < shakeWindow) {
    const decay = shakeDecay(frame, shakeWindow);
    // noise2D gives -1..1, scale to small jitter and decay
    translateX = noise2D("shake-enter-x", frame * 0.7, 0) * 10 * decay;
    translateY = noise2D("shake-enter-y", frame * 0.7, 5) * 6 * decay;
    rotateDeg = noise2D("shake-enter-r", frame * 0.7, 10) * 1.2 * decay;
  } else if (exitTransition === "shake" && frame >= durationFrames - shakeWindow) {
    const localFrame = frame - (durationFrames - shakeWindow);
    const decay = shakeDecay(shakeWindow - localFrame, shakeWindow);
    translateX = noise2D("shake-exit-x", localFrame * 0.7, 0) * 10 * decay;
    translateY = noise2D("shake-exit-y", localFrame * 0.7, 5) * 6 * decay;
    rotateDeg = noise2D("shake-exit-r", localFrame * 0.7, 10) * 1.2 * decay;
  } else if (enterTransition === "whip-pan" && frame < transitionFrames) {
    translateX = interpolate(frame, [0, transitionFrames], [-40, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    blurPx = interpolate(frame, [0, transitionFrames], [12, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  } else if (
    exitTransition === "whip-pan" &&
    frame >= durationFrames - transitionFrames
  ) {
    translateX = interpolate(
      frame,
      [durationFrames - transitionFrames, durationFrames],
      [0, 40],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }
    );
    blurPx = interpolate(
      frame,
      [durationFrames - transitionFrames, durationFrames],
      [0, 12],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }
    );
  }

  const baseFilter = getColorTreatmentFilter(effects?.colorTreatment);
  const blurFilter = blurPx > 0 ? `blur(${blurPx.toFixed(2)}px)` : undefined;
  const filter = [baseFilter, blurFilter].filter(Boolean).join(" ") || undefined;

  const entranceWindow = Math.max(1, Math.floor(durationFrames * 0.15));
  const vignetteDarkness = interpolate(
    frame,
    [0, entranceWindow, durationFrames],
    [0.6, 0.45, 0.4],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Compose transform: Ken-Burns scale + transition jitter
  const transforms: string[] = [];
  const isWhipPan = enterTransition === "whip-pan" || exitTransition === "whip-pan";
  const isShake = enterTransition === "shake" || exitTransition === "shake";
  if (translateX !== 0) {
    // whip-pan uses % (large -40..40), shake uses px (small ±10)
    transforms.push(`translateX(${translateX.toFixed(2)}${isWhipPan ? "%" : "px"})`);
  }
  if (isShake && translateY !== 0) transforms.push(`translateY(${translateY.toFixed(2)}px)`);
  if (isShake && rotateDeg !== 0) transforms.push(`rotate(${rotateDeg.toFixed(2)}deg)`);
  const transformValue = transforms.length > 0 ? transforms.join(" ") : undefined;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden", ...containerStyle }}>
      <Video
        src={resolvedUrl}
        startFrom={startFromFrames}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          scale: `${scale}`,
          transform: transformValue,
          filter,
        }}
        volume={0} // Mute raw footage audio to give full clarity to Voiceover
      />

      {effects?.grain && (
        <AbsoluteFill
          data-testid="footage-grain"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            opacity: effects.grainIntensity ?? 0.15,
            mixBlendMode: "overlay",
            pointerEvents: "none",
          }}
        />
      )}

      {effects?.vignette && (
        <AbsoluteFill
          data-testid="footage-vignette"
          style={{
            background: `radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, ${vignetteDarkness}) 100%)`,
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
};

export function VideoComposition({ projectState }: VideoCompositionProps) {
  const { fps } = useVideoConfig();

  const videoTrack = projectState.tracks.find((t) => t.id === "video");
  const textTrack = projectState.tracks.find((t) => t.id === "text");
  const audioTrack = projectState.tracks.find((t) => t.id === "audio");

  const boundaries = React.useMemo(() => {
    if (!videoTrack?.items) return [];
    return getStreamBoundaries(videoTrack.items, fps);
  }, [videoTrack?.items, fps]);

  const exitClipIds = React.useMemo(() => {
    if (projectState.transitionStyle !== "whip-pan") return new Set<string>();
    return new Set(boundaries.map((b) => b.a.id));
  }, [boundaries, projectState.transitionStyle]);

  const enterClipIds = React.useMemo(() => {
    if (projectState.transitionStyle !== "whip-pan") return new Set<string>();
    return new Set(boundaries.map((b) => b.b.id));
  }, [boundaries, projectState.transitionStyle]);

  // Renders one visual layer. Multiple items with overlapping
  // trackStart/trackEnd coexist by design — stacking order follows the
  // video track's item order (zIndex-sorted by the adapter).
  const renderLayer = (item: EditorClip) => {
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
          <AbsoluteFill style={{ pointerEvents: isOverlayRole(item) ? "none" : undefined }}>
            <MotionComp
              {...(item.props || {})}
              durationInFrames={durationFrames}
              layoutRole={item.layoutRole}
              timings={item.timings || (item.props?.timings as never)}
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

    // Video / Footage Clip (or image layer)
    const rawUrl = item.storageUrl || item.storagePath;
    const resolvedUrl = resolveMediaUrl(rawUrl);
    const startFromFrames = Math.max(0, Math.round((item.sourceIn || 0) * fps));
    const geometry = layerGeometry(item.layoutRole);

    if (!resolvedUrl) {
      return (
        <Sequence
          key={item.id}
          from={fromFrame}
          durationInFrames={durationFrames}
          name={item.id}
        >
          <AbsoluteFill style={{ backgroundColor: "#0f172a", justifyContent: "center", alignItems: "center", ...geometry, pointerEvents: isOverlayRole(item) ? "none" : undefined }}>
            <span className="text-slate-400 font-mono text-sm">No footage media source</span>
          </AbsoluteFill>
        </Sequence>
      );
    }

    // Per-clip shake takes precedence over boundary-based whip-pan
    const perClipEnter = (item as EditorClip).enterTransition;
    const perClipExit = (item as EditorClip).exitTransition;
    const exitTransition: ClipTransitionKind | undefined =
      perClipExit ?? (exitClipIds.has(item.id) ? ("whip-pan" as const) : undefined);
    const enterTransition: ClipTransitionKind | undefined =
      perClipEnter ?? (enterClipIds.has(item.id) ? ("whip-pan" as const) : undefined);

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
          containerStyle={{ ...geometry, pointerEvents: isOverlayRole(item) ? "none" : undefined }}
          effects={item.effects}
          exitTransition={exitTransition}
          enterTransition={enterTransition}
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
      {/* 1. Video & Motion Layers — zIndex-sorted, overlapping by design */}
      {videoTrack?.items.map((item) => renderLayer(item))}

      {/* 2. Clip-Boundary Transitions (flash / glitch) — rendered above video layers */}
      {projectState.transitionStyle === "flash" &&
        boundaries.map((boundary, idx) => {
          const flashFrames = 6;
          const half = Math.floor(flashFrames / 2);
          const from = Math.max(0, boundary.boundaryFrame - half);
          return (
            <Sequence
              key={`flash-${boundary.a.id}-${boundary.b.id}-${idx}`}
              from={from}
              durationInFrames={flashFrames}
              name={`flash-transition-${boundary.boundaryFrame}`}
            >
              <FlashTransition flashFrames={flashFrames} />
            </Sequence>
          );
        })}

      {projectState.transitionStyle === "glitch" &&
        boundaries.map((boundary, idx) => {
          const glitchFrames = 8;
          const half = Math.floor(glitchFrames / 2);
          const from = Math.max(0, boundary.boundaryFrame - half);
          return (
            <Sequence
              key={`glitch-${boundary.a.id}-${boundary.b.id}-${idx}`}
              from={from}
              durationInFrames={glitchFrames}
              name={`glitch-transition-${boundary.boundaryFrame}`}
            >
              <GlitchTransition glitchFrames={glitchFrames} />
            </Sequence>
          );
        })}

      {/* 3. Text / Captions Overlay Layer */}
      {textTrack?.items.map((item) => renderTextItem(item))}

      {/* 4. Audio Voiceover Track Layer */}
      {audioTrack?.items.map((item) => renderAudioItem(item))}
    </AbsoluteFill>
  );
}
