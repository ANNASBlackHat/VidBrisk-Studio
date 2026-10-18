import {
  EngineInfo,
  EngineListResponse,
  JobApprovalRequest,
  JobCreateRequest,
  JobResponse,
  JobSummaryResponse,
  RenderVideoResponse,
  TimelineJSON,
  VoiceListResponse,
} from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  try {
    const res = await fetch(url, config);

    if (!res.ok) {
      let errorBody: unknown = null;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text();
      }
      
      let message = `Request failed with status ${res.status}`;
      if (typeof errorBody === "object" && errorBody !== null && "detail" in errorBody) {
        message = String((errorBody as { detail: unknown }).detail);
      } else if (typeof errorBody === "string" && errorBody.length > 0) {
        message = errorBody;
      }
      
      throw new ApiError(message, res.status, errorBody);
    }

    if (res.status === 204) {
      return undefined as unknown as T;
    }

    const text = await res.text();
    if (!text || text.trim().length === 0) {
      return undefined as unknown as T;
    }

    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? error.message : "Network error or server unreachable",
      0
    );
  }
}

export const api = {
  /**
   * List video generation jobs with optional filters
   */
  async getJobs(params?: {
    limit?: number;
    offset?: number;
    stage?: string;
    status?: string;
  }): Promise<JobSummaryResponse[]> {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", params.limit.toString());
    if (params?.offset) query.set("offset", params.offset.toString());
    if (params?.stage) query.set("stage", params.stage);
    if (params?.status) query.set("status", params.status);

    const queryString = query.toString();
    return request<JobSummaryResponse[]>(
      `/jobs${queryString ? `?${queryString}` : ""}`
    );
  },

  /**
   * Get full details of a specific job
   */
  async getJob(jobId: string): Promise<JobResponse> {
    return request<JobResponse>(`/jobs/${jobId}`);
  },

  /**
   * Submit a new video generation job (supports JSON and multipart upload for custom audio)
   */
  async createJob(
    payload: JobCreateRequest,
    audioFile?: File | Blob | null
  ): Promise<JobResponse> {
    const file = audioFile || (payload.audio_file as File | Blob | undefined);
    if (file) {
      const formData = new FormData();
      if (payload.title) formData.append("title", payload.title);
      if (payload.raw_input) formData.append("raw_input", payload.raw_input);
      if (payload.script) formData.append("script", payload.script);
      if (payload.prompt) formData.append("prompt", payload.prompt);
      if (payload.target_orientation) formData.append("target_orientation", payload.target_orientation);
      if (payload.auto_approve !== undefined) formData.append("auto_approve", String(payload.auto_approve));
      if (payload.aligner_provider) formData.append("aligner_provider", payload.aligner_provider);
      if (payload.single_pass_llm !== undefined) formData.append("single_pass_llm", String(payload.single_pass_llm));
      if (payload.voice) formData.append("voice", payload.voice);
      if (payload.voice_prompt) formData.append("voice_prompt", payload.voice_prompt);
      if (payload.engine) formData.append("engine", payload.engine);
      formData.append("voice_type", payload.voice_type || "custom");
      formData.append("tts_provider", payload.tts_provider || "custom");
      formData.append("audio_file", file);

      return request<JobResponse>("/jobs", {
        method: "POST",
        body: formData,
      });
    }

    return request<JobResponse>("/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Fetch available local voice profiles and OmniVoice valid tags
   */
  async getVoices(): Promise<VoiceListResponse> {
    try {
      return await request<VoiceListResponse>("/api/voices");
    } catch {
      return await request<VoiceListResponse>("/voices");
    }
  },

  /**
   * Recommend optimal voice design prompt for a video script
   */
  async recommendVoicePrompt(params: {
    script: string;
    genre?: string;
    channel?: string;
  }): Promise<{ recommended_prompt: string; reasoning: string }> {
    try {
      return await request<{ recommended_prompt: string; reasoning: string }>("/api/voices/recommend-prompt", {
        method: "POST",
        body: JSON.stringify(params),
      });
    } catch {
      return await request<{ recommended_prompt: string; reasoning: string }>("/voices/recommend-prompt", {
        method: "POST",
        body: JSON.stringify(params),
      });
    }
  },

  /**
   * Fetch compiled timeline JSON for Remotion/Editor
   */
  async getTimeline(jobId: string): Promise<TimelineJSON> {
    return request<TimelineJSON>(`/jobs/${jobId}/timeline`);
  },

  /**
   * Approve a human-in-the-loop checkpoint or submit overrides
   */
  async approveJob(
    jobId: string,
    payload: JobApprovalRequest
  ): Promise<JobResponse> {
    return request<JobResponse>(`/jobs/${jobId}/approve`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Retry a failed job from its last checkpoint
   */
  async retryJob(jobId: string): Promise<JobResponse> {
    return request<JobResponse>(`/jobs/${jobId}/retry`, {
      method: "POST",
    });
  },

  /**
   * Cancel an active or pending job
   */
  async cancelJob(jobId: string): Promise<JobResponse> {
    return request<JobResponse>(`/jobs/${jobId}/cancel`, {
      method: "POST",
    });
  },

  /**
   * Fetch available video rendering engines supported by backend
   */
  async getEngines(): Promise<EngineListResponse> {
    const descriptions: Record<string, string> = {
      remotion: "Full React documentary motion graphics & rich charts",
      hyperframes: "Declarative HTML5/GSAP canvas, zero npm requirements",
      native_fast: "Pure FFmpeg filtergraphs, ultra-fast headless render",
    };

    try {
      const data = await request<any>("/jobs/engines/list");
      if (data && Array.isArray(data.engines)) {
        const normalizedEngines: EngineInfo[] = data.engines.map((e: any) => {
          if (typeof e === "string") {
            return {
              name: e,
              description: descriptions[e] || `${e} video engine`,
              is_default: e === (data.default || "remotion"),
            };
          }
          return e;
        });
        return {
          engines: normalizedEngines,
          default: data.default || "remotion",
        };
      }
      return data;
    } catch {
      return {
        engines: [
          { name: "remotion", description: "Full React documentary motion graphics & rich charts", is_default: true },
          { name: "hyperframes", description: "Declarative HTML5/GSAP canvas, zero npm requirements", is_default: false },
          { name: "native_fast", description: "Pure FFmpeg filtergraphs, ultra-fast headless render", is_default: false },
        ],
        default: "remotion",
      };
    }
  },

  /**
   * Render timeline to standalone MP4 via async background worker
   */
  async renderVideo(
    jobId: string,
    payload: { timeline?: TimelineJSON },
    params?: { width?: number; height?: number; fps?: number; engine?: string }
  ): Promise<RenderVideoResponse> {
    const query = new URLSearchParams();
    if (params?.width) query.set("width", params.width.toString());
    if (params?.height) query.set("height", params.height.toString());
    if (params?.fps) query.set("fps", params.fps.toString());
    if (params?.engine) query.set("engine", params.engine);

    const qs = query.toString();
    return request<RenderVideoResponse>(
      `/jobs/${jobId}/render${qs ? `?${qs}` : ""}`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
  },

  /**
   * Get Server-Sent Events (SSE) stream URL for real-time progress
   */
  getJobStreamUrl(jobId: string): string {
    return `${API_BASE_URL}/jobs/${jobId}/stream`;
  },

  /**
   * Update mutable job metadata like title
   */
  async updateJob(
    jobId: string,
    payload: { title?: string }
  ): Promise<JobResponse> {
    return request<JobResponse>(`/jobs/${jobId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Delete a video generation job and its artifacts
   */
  async deleteJob(jobId: string): Promise<void> {
    return request<void>(`/jobs/${jobId}`, {
      method: "DELETE",
    });
  },

  /**
   * Check backend health
   */
  async getHealth(): Promise<{ status: string; service: string }> {
    return request<{ status: string; service: string }>("/health");
  },

  /**
   * Browse footage library shots with filters
   */
  async getFootageShots(params: import("./types").ShotFilterParams = {}): Promise<import("./types").ShotsListResponse> {
    const searchParams = new URLSearchParams();
    if (params.provider && params.provider !== "all") searchParams.set("provider", params.provider);
    if (params.orientation && params.orientation !== "all") searchParams.set("orientation", params.orientation);
    if (params.min_duration !== undefined) searchParams.set("min_duration", params.min_duration.toString());
    if (params.max_duration !== undefined) searchParams.set("max_duration", params.max_duration.toString());
    if (params.min_motion !== undefined) searchParams.set("min_motion", params.min_motion.toString());
    if (params.used && params.used !== "all") searchParams.set("used", params.used);
    if (params.sort) searchParams.set("sort", params.sort);
    if (params.limit !== undefined) searchParams.set("limit", params.limit.toString());
    if (params.offset !== undefined) searchParams.set("offset", params.offset.toString());

    const qs = searchParams.toString();
    return request<import("./types").ShotsListResponse>(`/footage/shots${qs ? `?${qs}` : ""}`);
  },

  /**
   * Get single shot detail
   */
  async getFootageShotDetail(shotId: string): Promise<import("./types").Shot> {
    return request<import("./types").Shot>(`/footage/shots/${shotId}`);
  },

  /**
   * Semantic vector search across footage shots
   */
  async searchFootage(req: import("./types").FootageSearchRequest): Promise<import("./types").FootageSearchResponse> {
    return request<import("./types").FootageSearchResponse>("/footage/search", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  /**
   * Footage library analytics summary
   */
  async getFootageAnalytics(): Promise<import("./types").FootageAnalyticsSummary> {
    return request<import("./types").FootageAnalyticsSummary>("/footage/analytics/summary");
  },

  /**
   * Available embedding models
   */
  async getFootageModels(): Promise<import("./types").EmbeddingModelInfo[]> {
    return request<import("./types").EmbeddingModelInfo[]>("/footage/models");
  },

  /**
   * Get duplicate clusters by tier
   */
  async getFootageDuplicates(tier?: string, status: string = "pending"): Promise<import("./types").DuplicateGroupsResponse> {
    const params = new URLSearchParams();
    if (tier && tier !== "all") params.set("tier", tier);
    if (status && status !== "all") params.set("status", status);
    const qs = params.toString();
    return request<import("./types").DuplicateGroupsResponse>(`/footage/duplicates${qs ? `?${qs}` : ""}`);
  },

  /**
   * Trigger duplicate scan
   */
  async triggerDetectDuplicates(maxGroups: number = 10): Promise<{ status: string; groups_created: number }> {
    return request<{ status: string; groups_created: number }>(`/footage/duplicates/detect?max_groups=${maxGroups}`, {
      method: "POST",
    });
  },

  /**
   * Resolve duplicate group (merge, keep, archive)
   */
  async resolveFootageDuplicate(groupId: string, req: import("./types").DuplicateResolutionRequest): Promise<{ status: string }> {
    return request<{ status: string }>(`/footage/duplicates/${groupId}/resolve`, {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  /**
   * Get 2D embedding map points and clusters
   */
  async getFootageMap(modelId: string = "xclip-base-patch32"): Promise<import("./types").MapDataResponse> {
    return request<import("./types").MapDataResponse>(`/footage/map?model=${encodeURIComponent(modelId)}`);
  },

  /**
   * Recompute 2D embedding projection
   */
  async recomputeFootageMap(modelId: string = "xclip-base-patch32", maxPoints: number = 150): Promise<{ status: string; projected_points: number }> {
    return request<{ status: string; projected_points: number }>(`/footage/map/recompute?model=${encodeURIComponent(modelId)}&max_points=${maxPoints}`, {
      method: "POST",
    });
  },

  /**
   * List controlled vocabulary entities
   */
  async getFootageEntities(): Promise<import("./types").Entity[]> {
    return request<import("./types").Entity[]>("/footage/entities");
  },

  /**
   * Create a new named subject entity
   */
  async createFootageEntity(body: import("./types").EntityCreateRequest): Promise<import("./types").Entity> {
    return request<import("./types").Entity>("/footage/entities", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /**
   * Get suggested unlinked shots for an entity
   */
  async getEntitySuggestions(entityId: string, limit: number = 12): Promise<import("./types").Shot[]> {
    return request<import("./types").Shot[]>(`/footage/entities/${entityId}/suggestions?limit=${limit}`);
  },

  /**
   * Link a shot to an entity
   */
  async linkShotEntity(shotId: string, entityId: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/footage/shots/${shotId}/entities`, {
      method: "POST",
      body: JSON.stringify({ entity_id: entityId }),
    });
  },

  /**
   * List jobs available for selection debugging
   */
  async getDebuggerJobs(limit: number = 20): Promise<import("./types").DebuggerJobListItem[]> {
    return request<import("./types").DebuggerJobListItem[]>(`/footage/debugger/jobs?limit=${limit}`);
  },

  /**
   * Get full per-beat selection debugging details for a job
   */
  async getJobSelectionDebug(jobId: string): Promise<import("./types").DebuggerJob> {
    return request<import("./types").DebuggerJob>(`/footage/debugger/${jobId}`);
  },

  /**
   * Override a beat's selected footage candidate
   */
  async overrideDebuggerSelection(jobId: string, beatId: string, chunkId: string): Promise<{ status: string }> {
    return request<{ status: string }>(`/footage/debugger/${jobId}/override`, {
      method: "POST",
      body: JSON.stringify({ beat_id: beatId, chunk_id: chunkId }),
    });
  },

  /**
   * Run model retrieval comparative evaluation
   */
  async runEvalCompare(body: import("./types").EvalCompareRequest): Promise<import("./types").EvalCompareResponse> {
    return request<import("./types").EvalCompareResponse>("/footage/eval/compare", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /**
   * Get shots for the curation queue
   */
  async getCurationQueue(status: string = "pending", limit: number = 30, offset: number = 0): Promise<import("./types").CurationQueueResponse> {
    return request<import("./types").CurationQueueResponse>(`/footage/curation/queue?status=${status}&limit=${limit}&offset=${offset}`);
  },

  /**
   * Apply curation status and tags to a shot
   */
  async updateShotCuration(chunkId: string, status: "approved" | "rejected" | "pending", tags?: string[]): Promise<{ status: string }> {
    return request<{ status: string }>(`/footage/curation/${chunkId}`, {
      method: "POST",
      body: JSON.stringify({ status, tags }),
    });
  },
};
