import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export interface FlashTransitionProps {
  color?: string;
  flashFrames?: number;
}

export const FlashTransition: React.FC<FlashTransitionProps> = ({
  color = "#ffffff",
  flashFrames = 6,
}) => {
  const frame = useCurrentFrame();
  const midFrame = Math.max(1, Math.floor(flashFrames / 2));

  const opacity = interpolate(frame, [0, midFrame, flashFrames], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      data-testid="flash-transition"
      style={{
        backgroundColor: color,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};
