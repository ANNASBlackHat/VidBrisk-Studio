import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "@/lib/api";
import { formatFileSize, formatDuration } from "@/lib/utils";
import { JobCreateRequest } from "@/lib/types";

describe("Custom Audio Upload & API Integration", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("submits application/json payload when creating job without audio file", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "job-tts-123", status: "pending", stage: "cleaning" }),
    });
    globalThis.fetch = mockFetch;

    const payload: JobCreateRequest = {
      title: "Apollo Landing",
      raw_input: "Welcome to Apollo 11 mission.",
      tts_provider: "kokoro",
      voice_type: "af_heart",
      target_orientation: "horizontal",
      auto_approve: false,
    };

    const res = await api.createJob(payload);
    expect(res.id).toBe("job-tts-123");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/jobs");
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(options.body)).toEqual(payload);
  });

  it("submits multipart/form-data with audio file when audioFile is provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "job-custom-audio-456", status: "pending", stage: "cleaning" }),
    });
    globalThis.fetch = mockFetch;

    const fakeFile = new File(["fake audio buffer content"], "voiceover.mp3", {
      type: "audio/mp3",
    });

    const payload: JobCreateRequest = {
      title: "Custom Voiceover Video",
      raw_input: "Voiceover transcript here",
      target_orientation: "vertical",
      auto_approve: true,
    };

    const res = await api.createJob(payload, fakeFile);
    expect(res.id).toBe("job-custom-audio-456");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/jobs");
    expect(options.method).toBe("POST");

    // Important: Content-Type header must NOT be hardcoded so browser/fetch can insert multipart boundary
    expect(options.headers["Content-Type"]).toBeUndefined();
    expect(options.body).toBeInstanceOf(FormData);

    const formData = options.body as FormData;
    expect(formData.get("title")).toBe("Custom Voiceover Video");
    expect(formData.get("voice_type")).toBe("custom");
    expect(formData.get("tts_provider")).toBe("custom");
    expect(formData.get("target_orientation")).toBe("vertical");
    expect(formData.get("auto_approve")).toBe("true");
    expect(formData.get("audio_file")).toBeDefined();
  });

  it("formats file sizes accurately", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512.0 B");
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1024 * 1024 * 3.45)).toBe("3.5 MB");
    expect(formatFileSize(1024 * 1024 * 48)).toBe("48.0 MB");
  });

  it("formats duration correctly for audio preview", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(65.4)).toBe("01:05.4");
  });
});
