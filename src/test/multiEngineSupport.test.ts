import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "@/lib/api";
import { JobCreateRequest, TimelineJSON } from "@/lib/types";
import { timelineToEditorState } from "@/adapters/timelineToEditorState";

describe("Multi-Engine Support & API Integration", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("fetches engine list from /jobs/engines/list endpoint", async () => {
    const mockResponse = {
      engines: [
        { name: "remotion", description: "Full React documentary motion graphics", is_default: true },
        { name: "hyperframes", description: "Declarative HTML5/GSAP canvas", is_default: false },
        { name: "native_fast", description: "Pure FFmpeg filtergraphs", is_default: false },
      ],
      default: "remotion",
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockResponse),
    });
    globalThis.fetch = mockFetch;

    const res = await api.getEngines();
    expect(res.engines).toHaveLength(3);
    expect(res.default).toBe("remotion");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/jobs/engines/list"),
      expect.anything()
    );
  });

  it("normalizes string array from /jobs/engines/list into EngineInfo objects", async () => {
    const rawBackendResponse = {
      engines: ["remotion", "hyperframes", "native_fast"],
      default: "remotion",
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(rawBackendResponse),
    });
    globalThis.fetch = mockFetch;

    const res = await api.getEngines();
    expect(res.engines).toHaveLength(3);
    expect(res.default).toBe("remotion");
    expect(res.engines[0]).toEqual({
      name: "remotion",
      description: "Full React documentary motion graphics & rich charts",
      is_default: true,
    });
    expect(res.engines[1]).toEqual({
      name: "hyperframes",
      description: "Declarative HTML5/GSAP canvas, zero npm requirements",
      is_default: false,
    });
    expect(res.engines[2]).toEqual({
      name: "native_fast",
      description: "Pure FFmpeg filtergraphs, ultra-fast headless render",
      is_default: false,
    });
  });

  it("falls back to default engines if /jobs/engines/list fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "Not Found",
    });
    globalThis.fetch = mockFetch;

    const res = await api.getEngines();
    expect(res.engines).toHaveLength(3);
    expect(res.default).toBe("remotion");
    expect(res.engines.map((e) => e.name)).toEqual(["remotion", "hyperframes", "native_fast"]);
  });

  it("submits engine in JSON payload when creating a job without audio file", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "job-engine-1", engine: "hyperframes", status: "pending" }),
    });
    globalThis.fetch = mockFetch;

    const payload: JobCreateRequest = {
      title: "HyperFrames Video",
      raw_input: "Testing HyperFrames video generation",
      engine: "hyperframes",
      target_orientation: "horizontal",
    };

    const res = await api.createJob(payload);
    expect(res.id).toBe("job-engine-1");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.engine).toBe("hyperframes");
  });

  it("appends engine to FormData when creating a job with custom audio file", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "job-engine-audio-2", engine: "native_fast", status: "pending" }),
    });
    globalThis.fetch = mockFetch;

    const fakeFile = new File(["audio bytes"], "narrate.wav", { type: "audio/wav" });
    const payload: JobCreateRequest = {
      title: "Native Fast with Audio",
      raw_input: "Audio description",
      engine: "native_fast",
      target_orientation: "vertical",
    };

    const res = await api.createJob(payload, fakeFile);
    expect(res.id).toBe("job-engine-audio-2");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    const formData = options.body as FormData;
    expect(formData.get("engine")).toBe("native_fast");
  });

  it("passes engine query parameter in api.renderVideo", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ job_id: "job-render-3", status: "enqueued" }),
    });
    globalThis.fetch = mockFetch;

    const dummyTimeline: TimelineJSON = {
      total_duration: 15,
      tracks: [],
    };

    await api.renderVideo(
      "job-render-3",
      { timeline: dummyTimeline },
      { width: 1920, height: 1080, fps: 30, engine: "native_fast" }
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/jobs/job-render-3/render");
    expect(url).toContain("engine=native_fast");
    expect(url).toContain("width=1920");
    expect(url).toContain("height=1080");
    expect(url).toContain("fps=30");
  });

  it("extracts render_engine from timeline metadata in timelineToEditorState", () => {
    const timelineWithEngine: TimelineJSON = {
      total_duration: 10,
      tracks: [
        {
          type: "video",
          items: [
            {
              id: "b1_v1",
              trackStart: 0,
              trackEnd: 5,
              assetId: "v1",
            },
          ],
        },
      ],
      metadata: {
        render_engine: "hyperframes",
      },
    };

    const editorState = timelineToEditorState(timelineWithEngine, "horizontal", "job-hf");
    expect(editorState.engine).toBe("hyperframes");
  });

  it("defaults engine to remotion if not present in timeline metadata", () => {
    const timelineWithoutEngine: TimelineJSON = {
      total_duration: 10,
      tracks: [],
    };

    const editorState = timelineToEditorState(timelineWithoutEngine, "horizontal", "job-default");
    expect(editorState.engine).toBe("remotion");
  });
});
