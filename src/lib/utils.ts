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

/**
 * Formats render duration and elapsed time into human-friendly MM:SS format,
 * e.g. "01:30s" or "01:30s (1m 30s)"
 */
export function formatRenderTime(seconds: number, verbose = false): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "00:00s";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const mm = mins.toString().padStart(2, "0");
  const ss = secs.toString().padStart(2, "0");

  if (mins > 0) {
    return verbose ? `${mm}:${ss}s (${mins}m ${secs}s)` : `${mm}:${ss}s`;
  }
  return verbose ? `${mm}:${ss}s (${seconds.toFixed(1)}s)` : `${mm}:${ss}s`;
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

export function resolveMediaUrl(pathOrUrl?: string): string {
  if (!pathOrUrl) return "";

  // Remote HTTP/HTTPS media (Pexels, Pixabay, S3, or local CLI mediaServer)
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }

  // Local filesystem path in Next.js browser
  const cleanPath = pathOrUrl.replace("file://", "");
  return `/api/media?path=${encodeURIComponent(cleanPath)}`;
}
