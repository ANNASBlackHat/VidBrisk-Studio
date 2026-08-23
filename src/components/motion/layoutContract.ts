import { LayoutRole } from "@/lib/types";

export type DisplayMode = "overlay" | "takeover" | "split";

/** Roles that float above base footage and must not capture pointer events. */
export const OVERLAY_ROLES: LayoutRole[] = [
  "overlay-lower-third",
  "corner-tl",
  "corner-tr",
  "corner-bl",
  "corner-br",
];

/**
 * Resolves the effective display mode for a motion component.
 *
 * `layoutRole` is authoritative when present; the legacy `mode` /
 * `display_mode` props are deprecated aliases kept for pre-layers timelines.
 */
export function resolveDisplay(opts: {
  layoutRole?: LayoutRole;
  mode?: string;
  display_mode?: string;
}): DisplayMode {
  const { layoutRole, mode, display_mode } = opts;
  if (layoutRole) {
    if (layoutRole === "split-left" || layoutRole === "split-right") return "split";
    if (layoutRole === "full" || layoutRole === "takeover") return "takeover";
    return "overlay";
  }
  if (display_mode === "takeover") return "takeover";
  if (mode === "takeover") return "takeover";
  return "overlay";
}

/**
 * Container style contract: overlay roles render transparently and never
 * capture pointer events; full/takeover render opaque full-bleed.
 */
export function displayContainerStyle(mode: DisplayMode): React.CSSProperties {
  if (mode === "overlay") {
    return { backgroundColor: "transparent", pointerEvents: "none", overflow: "hidden" };
  }
  return { overflow: "hidden" };
}
