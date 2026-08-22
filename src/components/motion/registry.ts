import React from "react";
import { StatCard, StatCardProps } from "./StatCard";
import { Typewriter, TypewriterProps } from "./Typewriter";
import { QuoteCard, QuoteCardProps } from "./QuoteCard";
import { StandardCard, StandardCardProps } from "./StandardCard";
import { SplitScreen, SplitScreenProps } from "./SplitScreen";

export type MotionComponentProps =
  | StatCardProps
  | TypewriterProps
  | QuoteCardProps
  | StandardCardProps
  | SplitScreenProps
  | Record<string, unknown>;

/**
 * Component Registry mapping backend componentId strings to React/Remotion components.
 * Matches backend `ComponentRegistry` in backend/components/registry.py.
 */
export const MOTION_COMPONENTS: Record<
  string,
  React.ComponentType<MotionComponentProps>
> = {
  "DataAnimations/StatCard": StatCard as React.ComponentType<MotionComponentProps>,
  "TextAnimations/Typewriter": Typewriter as React.ComponentType<MotionComponentProps>,
  "TextAnimations/QuoteCard": QuoteCard as React.ComponentType<MotionComponentProps>,
  "TextAnimations/StandardCard": StandardCard as React.ComponentType<MotionComponentProps>,
  "Layouts/SplitScreen": SplitScreen as React.ComponentType<MotionComponentProps>,
};

/**
 * Resolves a motion component by its componentId or style fallback.
 */
export function getMotionComponent(
  componentId?: string
): React.ComponentType<MotionComponentProps> {
  if (!componentId) {
    return StandardCard as React.ComponentType<MotionComponentProps>;
  }

  // Exact match
  if (MOTION_COMPONENTS[componentId]) {
    return MOTION_COMPONENTS[componentId];
  }

  // Case-insensitive or partial match
  const cleanId = componentId.toLowerCase();
  for (const [key, comp] of Object.entries(MOTION_COMPONENTS)) {
    if (
      key.toLowerCase() === cleanId ||
      cleanId.includes(key.toLowerCase().split("/")[1])
    ) {
      return comp;
    }
  }

  return StandardCard as React.ComponentType<MotionComponentProps>;
}

export {
  StatCard,
  Typewriter,
  QuoteCard,
  StandardCard,
  SplitScreen,
};

export type {
  StatCardProps,
  TypewriterProps,
  QuoteCardProps,
  StandardCardProps,
  SplitScreenProps,
};
