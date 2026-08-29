import React from "react";

/**
 * Minimal stand-ins for the Remotion primitives used by motion components.
 * Sequences render unconditionally so layer structure is assertable without
 * the full composition runtime.
 */
export const remotionMock = () => {
  const AbsoluteFill = ({
    style,
    children,
    "data-testid": testId,
    ...rest
  }: {
    style?: React.CSSProperties;
    children?: React.ReactNode;
    "data-testid"?: string;
    [key: string]: unknown;
  }) =>
    React.createElement(
      "div",
      { style, "data-testid": testId || "absolute-fill", ...rest },
      children
    );

  const Sequence = ({
    name,
    from,
    durationInFrames,
    children,
  }: {
    name?: string;
    from?: number;
    durationInFrames?: number;
    children?: React.ReactNode;
  }) =>
    React.createElement(
      "div",
      { "data-sequence": name, "data-from": from, "data-duration": durationInFrames },
      children
    );

  const Video = ({
    src,
    style,
  }: {
    src?: string;
    style?: React.CSSProperties;
    [key: string]: unknown;
  }) => React.createElement("video", { src, style });
  const Audio = ({ src }: { src?: string; [key: string]: unknown }) =>
    React.createElement("audio", { src });

  const useVideoConfig = () => ({
    fps: 30,
    width: 1920,
    height: 1080,
    durationInFrames: 240,
  });
  const useCurrentFrame = () => 0;

  const interpolate = (
    frame: number,
    input: number[],
    output: number[]
  ) =>
    output[0] +
    ((frame - input[0]) / (input[1] - input[0])) * (output[1] - output[0]);

  const spring = ({ frame }: { frame: number }) =>
    Math.min(1, Math.max(0, frame / 30));

  const Easing = {
    linear: (t: number) => t,
    out: () => (t: number) => 1 - (1 - t) * (1 - t),
    cubic: (t: number) => t,
    bezier: () => (t: number) => t,
    step0: (t: number) => (t > 0 ? 1 : 0),
    step1: (t: number) => (t >= 1 ? 0 : 1),
    poly: () => (t: number) => t,
    elastic: () => (t: number) => t,
    back: () => (t: number) => t,
    bounce: () => (t: number) => t,
    quad: (t: number) => t * t,
    sin: (t: number) => t,
    circle: (t: number) => t,
    exp: (t: number) => t,
  };

  const delayRender = (label?: string) => 1;
  const continueRender = (handle: number) => {};

  return {
    AbsoluteFill,
    Sequence,
    Video,
    Audio,
    useVideoConfig,
    useCurrentFrame,
    interpolate,
    spring,
    Easing,
    delayRender,
    continueRender,
  };
};
