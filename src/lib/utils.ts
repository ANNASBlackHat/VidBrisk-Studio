import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

/**
 * Resolves local file paths and remote media URLs through the proxy API
 * to ensure CORS compliance and Range seek support in Remotion Player.
 */
export function resolveMediaUrl(pathOrUrl?: string): string {
  if (!pathOrUrl) return "";

  // Local filesystem path (synthesized WAVs or local assets)
  if (
    pathOrUrl.startsWith("/Users/") ||
    pathOrUrl.startsWith("file://") ||
    (!pathOrUrl.startsWith("http://") &&
      !pathOrUrl.startsWith("https://") &&
      !pathOrUrl.startsWith("/"))
  ) {
    const cleanPath = pathOrUrl.replace("file://", "");
    return `/api/media?path=${encodeURIComponent(cleanPath)}`;
  }

  return pathOrUrl;
}
