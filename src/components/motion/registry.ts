import React from "react";
import { StatCard, StatCardProps, STAT_CARD_SUPPORTED_ROLES } from "./StatCard";
import { Typewriter, TypewriterProps, TYPEWRITER_SUPPORTED_ROLES } from "./Typewriter";
import { QuoteCard, QuoteCardProps, QUOTE_CARD_SUPPORTED_ROLES } from "./QuoteCard";
import { StandardCard, StandardCardProps, STANDARD_CARD_SUPPORTED_ROLES } from "./StandardCard";
import { SplitScreen, SplitScreenProps, SPLIT_SCREEN_SUPPORTED_ROLES } from "./SplitScreen";
import { KineticText, KineticTextProps, KINETIC_TEXT_SUPPORTED_ROLES } from "./KineticText";
import { SwipeDeck, SwipeDeckProps, SWIPE_DECK_SUPPORTED_ROLES } from "./SwipeDeck";
import { ChatBubbles, ChatBubblesProps, CHAT_BUBBLES_SUPPORTED_ROLES } from "./ChatBubbles";
import { MapExplainer, MapExplainerProps, MAP_EXPLAINER_SUPPORTED_ROLES } from "./MapExplainer";
import { AudioWaveform, AudioWaveformProps, AUDIO_WAVEFORM_SUPPORTED_ROLES } from "./AudioWaveform";
import { KineticCaptions, KineticCaptionsProps, KINETIC_CAPTIONS_SUPPORTED_ROLES } from "./KineticCaptions";
import { LayoutRole } from "@/lib/types";

/**
 * Formal layout contract shared by every motion component. Components declare
 * which LayoutRoles they support and must render transparently (with pointer
 * events disabled) for overlay roles vs. opaque full-bleed for full/takeover.
 */
export interface BaseMotionProps extends Record<string, unknown> {
  durationInFrames?: number;
  text?: string;
  layoutRole?: LayoutRole;
}

export type MotionComponentProps =
  | StatCardProps
  | TypewriterProps
  | QuoteCardProps
  | StandardCardProps
  | SplitScreenProps
  | KineticTextProps
  | SwipeDeckProps
  | ChatBubblesProps
  | MapExplainerProps
  | AudioWaveformProps
  | KineticCaptionsProps
  | BaseMotionProps;

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
  "TextAnimations/KineticText": KineticText as React.ComponentType<MotionComponentProps>,
  "TextAnimations/KineticCaptions": KineticCaptions as React.ComponentType<MotionComponentProps>,
  "ListAnimations/SwipeDeck": SwipeDeck as React.ComponentType<MotionComponentProps>,
  "ListAnimations/ChatBubbles": ChatBubbles as React.ComponentType<MotionComponentProps>,
  "Layouts/SplitScreen": SplitScreen as React.ComponentType<MotionComponentProps>,
  "GeoAnimations/MapExplainer": MapExplainer as React.ComponentType<MotionComponentProps>,
  "AudioAnimations/AudioWaveform": AudioWaveform as React.ComponentType<MotionComponentProps>,
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
  KineticText,
  SwipeDeck,
  ChatBubbles,
  MapExplainer,
  AudioWaveform,
  KineticCaptions,
  STAT_CARD_SUPPORTED_ROLES,
  TYPEWRITER_SUPPORTED_ROLES,
  QUOTE_CARD_SUPPORTED_ROLES,
  STANDARD_CARD_SUPPORTED_ROLES,
  SPLIT_SCREEN_SUPPORTED_ROLES,
  KINETIC_TEXT_SUPPORTED_ROLES,
  SWIPE_DECK_SUPPORTED_ROLES,
  CHAT_BUBBLES_SUPPORTED_ROLES,
  MAP_EXPLAINER_SUPPORTED_ROLES,
  AUDIO_WAVEFORM_SUPPORTED_ROLES,
  KINETIC_CAPTIONS_SUPPORTED_ROLES,
};

export type {
  StatCardProps,
  TypewriterProps,
  QuoteCardProps,
  StandardCardProps,
  SplitScreenProps,
  KineticTextProps,
  SwipeDeckProps,
  ChatBubblesProps,
  MapExplainerProps,
  AudioWaveformProps,
  KineticCaptionsProps,
};
