import {
  JobApprovalRequest,
  JobCreateRequest,
  JobResponse,
  JobSummaryResponse,
  RenderVideoResponse,
  TimelineJSON,
} from "./types";

const API_BASE_URL =
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
      formData.append("voice_type", "custom");
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
   * Render timeline to standalone MP4 via async background worker
   */
  async renderVideo(
    jobId: string,
    payload: { timeline?: TimelineJSON },
    params?: { width?: number; height?: number; fps?: number }
  ): Promise<RenderVideoResponse> {
    const query = new URLSearchParams();
    if (params?.width) query.set("width", params.width.toString());
    if (params?.height) query.set("height", params.height.toString());
    if (params?.fps) query.set("fps", params.fps.toString());

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
};
