/**
 * Official Remotion Sound Effects (matching @remotion/sfx catalog)
 * Hosted on Remotion's fast CDN at https://remotion.media/
 * Documentation: https://www.remotion.dev/docs/sfx/
 */

export const REMOTION_SFX = {
  whoosh: "https://remotion.media/whoosh.wav",
  whip: "https://remotion.media/whip.wav",
  shutterModern: "https://remotion.media/shutter-modern.wav",
  uiSwitch: "https://remotion.media/ui-switch.wav",
  ding: "https://remotion.media/ding.wav",
  pageTurn: "https://remotion.media/page-turn.wav",
} as const;

export type RemotionSfxName = keyof typeof REMOTION_SFX;

export interface TransitionSfxConfig {
  url: string;
  leadFrames: number;
  durationFrames: number;
  volume: number;
}

/**
 * Maps a visual transition style to its corresponding official Remotion sound effect.
 */
export function getTransitionSfx(style?: string): TransitionSfxConfig | null {
  switch (style) {
    case "whip-pan":
      return {
        url: REMOTION_SFX.whoosh,
        leadFrames: 4,
        durationFrames: 12,
        volume: 0.4,
      };
    case "flash":
      return {
        url: REMOTION_SFX.shutterModern,
        leadFrames: 2,
        durationFrames: 10,
        volume: 0.35,
      };
    case "glitch":
      return {
        url: REMOTION_SFX.uiSwitch,
        leadFrames: 3,
        durationFrames: 10,
        volume: 0.35,
      };
    default:
      return null;
  }
}
