/**
 * Type definitions matching Video Generation Pipeline Backend schemas and Timeline JSON shapes.
 */

export type JobStage =
  | "cleaning"
  | "structuring"
  | "voicing"
  | "aligning"
  | "resolving_footage"
  | "assembling"
  | "compiling"
  | "done"
  | "failed";

export type JobStatus =
  | "pending"
  | "in_progress"
  | "awaiting_approval"
  | "complete"
  | "failed";

export type TargetOrientation = "horizontal" | "vertical" | "square" | "any";

export type TransitionStyle = "none" | "flash" | "whip-pan" | "glitch";

export type ClipTransitionKind = "whip-pan" | "shake";

export type ColorTreatment =
  | "none"
  | "duotone-cool"
  | "duotone-warm"
  | "duotone-mono";

export interface FootageEffects {
  colorTreatment?: ColorTreatment;
  grain?: boolean;
  grainIntensity?: number;
  vignette?: boolean;
}

export type BeatType =
  | "narrative"
  | "stat"
  | "abstract"
  | "kinetic"
  | "quote"
  | "typewriter"
  | "swipe_deck"
  | "chat_bubbles"
  | "split_screen"
  | "map_route"
  | "audio_waveform";

export interface Beat {
  id: string;
  text: string;
  visual_intent: string;
  beat_type: BeatType;
  motion_props?: Record<string, unknown> | null;
  pause_after?: number;
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
  score?: number;
}

export interface BeatTiming {
  beat_id?: string;
  start: number;
  end: number;
  duration: number;
  words?: WordTiming[];
}

export interface VoiceClip {
  beat_id: string;
  audio_path: string;
  duration_sec: number;
  sample_rate?: number;
}

export interface FootageCandidate {
  chunk_id: string;
  media_id?: string;
  score?: number;
  similarity?: number;
  source_in: number;
  source_out: number;
  duration: number;
  storage_path?: string;
  storage_url?: string;
  thumbnail_url?: string;
  asset_type?: "video" | "image" | "motion";
  media_type?: string;
  provider?: string;
  tags?: string[];
}

export interface AssetPlanItem {
  type?: "video" | "image" | "text_card" | "motion";
  chunk_id?: string;
  assetId?: string;
  source_in?: number;
  source_out?: number;
  sourceIn?: number;
  sourceOut?: number;
  track_start?: number;
  track_end?: number;
  trackStart?: number;
  trackEnd?: number;
  storage_path?: string;
  storage_url?: string;
  content?: string;
  style?: string;
  component_id?: string;
  props?: Record<string, unknown>;
}

export interface AssetPlan {
  beat_id?: string;
  strategy: "single_clip" | "concat_clips" | "image_kenburns" | "motion_text" | string;
  items: AssetPlanItem[];
}

export type LayerRole = "background" | "midground" | "overlay" | "caption";

export type LayoutRole =
  | "full"
  | "overlay-lower-third"
  | "takeover"
  | "split-left"
  | "split-right"
  | "corner-tl"
  | "corner-tr"
  | "corner-bl"
  | "corner-br";

export interface Layer {
  role: LayerRole;
  z: number;
  type: "video" | "image" | "motion" | "text";
  layout: LayoutRole;
  chunkId?: string;
  sourceIn?: number;
  sourceOut?: number;
  storagePath?: string;
  storageUrl?: string;
  componentId?: string;
  content?: string;
  props?: Record<string, unknown>;
  style?: string;
}

export interface ResolvedBeatAssetPlan extends AssetPlan {
  layers?: Layer[];
}

export interface VideoTrackItem {
  id: string;
  trackStart: number;
  trackEnd: number;
  assetType: "video" | "image" | "motion";
  assetId?: string;
  sourceIn?: number;
  sourceOut?: number;
  storagePath?: string;
  storageUrl?: string;
  componentId?: string;
  props?: Record<string, unknown>;
  rawContent?: string;
  style?: string;
  zIndex?: number;
  layerRole?: LayerRole;
  /** Frontend extension so EditorClip.layoutRole survives round-trips */
  layoutRole?: LayoutRole;
}

export interface TextTrackItem {
  id: string;
  trackStart: number;
  trackEnd: number;
  content: string;
  style?: string;
  componentId?: string;
  props?: Record<string, unknown>;
  zIndex?: number;
  layerRole?: LayerRole;
}

export interface AudioTrackItem {
  id: string;
  trackStart: number;
  trackEnd: number;
  assetId: string;
}

export type TrackItem = VideoTrackItem | TextTrackItem | AudioTrackItem;

export interface Track {
  type: "video" | "text" | "audio";
  items: (VideoTrackItem | TextTrackItem | AudioTrackItem)[];
}

export interface TimelineJSON {
  tracks: Track[];
  total_duration: number;
  metadata?: {
    job_id?: string;
    beat_count?: number;
    footage_candidates?: Record<string, FootageCandidate[]>;
    resolved_beats?: Array<{
      beat: Beat;
      voice_clip?: VoiceClip;
      timings?: WordTiming[];
      candidates?: FootageCandidate[];
      asset_plan?: ResolvedBeatAssetPlan;
    }>;
    transition_style?: TransitionStyle;
    render_engine?: string;
    [key: string]: unknown;
  };
}

export type VideoEngineName = "remotion" | "hyperframes" | "native_fast" | string;

export interface EngineInfo {
  name: string;
  description: string;
  is_default: boolean;
}

export interface EngineListResponse {
  engines: EngineInfo[];
  default: string;
}

export interface JobCreateRequest {
  title?: string;
  raw_input?: string;
  script?: string;
  prompt?: string;
  engine?: VideoEngineName;
  voice_type?: "tts" | "custom" | string;
  voice?: string;
  voice_prompt?: string;
  tts_provider?: "kokoro" | "omni" | "supersonic" | "chatterbox" | "custom" | "mock" | string;
  aligner_provider?: "easytranscriber" | "whisperx" | "mock" | string;
  target_orientation?: TargetOrientation;
  auto_approve?: boolean;
  single_pass_llm?: boolean;
  audio_file?: File | Blob;
}

export interface VoiceProfile {
  id: string;
  name: string;
  filename: string;
  has_text: boolean;
  transcript?: string;
  preview_url?: string;
}

export interface VoiceListResponse {
  custom_voices: VoiceProfile[];
  default_instruct: string;
  valid_tags: string[];
}

export interface JobUpdateRequest {
  title?: string;
}

export interface JobApprovalRequest {
  action: "approve" | "reject";
  beats_override?: Beat[];
  candidates_override?: Record<string, FootageCandidate[]>;
}

export interface JobProgress {
  stage?: string;
  current?: number;
  total?: number;
  percent?: number;
  message?: string;
  render_engine?: string;
}

export interface JobSummaryResponse {
  id: string;
  title?: string | null;
  stage: JobStage;
  status: JobStatus;
  engine?: VideoEngineName;
  tts_provider: string;
  aligner_provider: string;
  target_orientation: TargetOrientation;
  auto_approve: boolean;
  created_at: string;
  updated_at: string;
  error_message?: string | null;
  progress?: JobProgress | null;
}

export interface JobResponse {
  id: string;
  title?: string | null;
  raw_input: string;
  stage: JobStage;
  status: JobStatus;
  engine?: VideoEngineName;
  tts_provider: string;
  aligner_provider: string;
  target_orientation: TargetOrientation;
  auto_approve: boolean;
  single_pass_llm: boolean;
  clean_script?: string | null;
  beats?: Beat[] | null;
  voice_clips?: VoiceClip[] | null;
  timings?: Record<string, BeatTiming> | null;
  footage_candidates?: Record<string, FootageCandidate[]> | null;
  asset_plan?: AssetPlan[] | null;
  timeline?: TimelineJSON | null;
  error_message?: string | null;
  progress?: JobProgress | null;
  video_url?: string | null;
  created_at: string;
  updated_at: string;
}

export type RenderEngineType = "remotion-native" | "ffmpeg-fallback" | "remotion-colab";

export interface RenderVideoResponse {
  status: string;
  job_id?: string;
  message?: string;
  stream_url?: string;
  render_engine?: RenderEngineType;
  video_url?: string;
  filename?: string;
  width?: number;
  height?: number;
  fps?: number;
}

export const STAGE_CONFIGS: {
  key: JobStage;
  label: string;
  description: string;
  stepNumber: number;
}[] = [
  { key: "cleaning", label: "Script Cleaning", description: "Stripping visual directions & non-narration text", stepNumber: 1 },
  { key: "structuring", label: "Beat Structuring", description: "Segmenting narration into beats & visual intent", stepNumber: 2 },
  { key: "voicing", label: "Voice Synthesis", description: "Generating voiceover audio per beat", stepNumber: 3 },
  { key: "aligning", label: "Timestamp Alignment", description: "Computing word & beat-level timestamps", stepNumber: 4 },
  { key: "resolving_footage", label: "Footage Resolution", description: "Searching and ranking footage chunks", stepNumber: 5 },
  { key: "assembling", label: "Assembly & Gap-Filling", description: "Applying duration matching & fallbacks", stepNumber: 6 },
  { key: "compiling", label: "Timeline Compilation", description: "Compiling tracks and motion components", stepNumber: 7 },
];

export interface Shot {
  id: string;
  asset_id: string;
  provider: string;
  source_url: string;
  storage_path?: string;
  storage_url?: string;
  thumbnail_url?: string;
  start_ts: number;
  end_ts?: number;
  duration_sec: number;
  resolution?: string;
  width?: number;
  height?: number;
  orientation: "horizontal" | "vertical" | "square" | "unknown";
  media_type: string;
  motion_mean?: number;
  motion_std?: number;
  motion_score?: number;
  is_loop: boolean;
  usage_count: number;
  last_used_at?: string;
  created_at?: string;
  caption?: string;
  tags: string[];
  entity_id?: string;
  entity_name?: string;
  similarity_score?: number;
  item_metadata?: Record<string, unknown>;
}

export interface ShotsListResponse {
  items: Shot[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface ShotFilterParams {
  provider?: string;
  orientation?: string;
  min_duration?: number;
  max_duration?: number;
  min_motion?: number;
  used?: "all" | "used" | "unused";
  sort?: "newest" | "oldest" | "duration_desc" | "duration_asc" | "motion_desc" | "usage_desc";
  limit?: number;
  offset?: number;
}

export interface FootageSearchRequest {
  query: string;
  model_id?: string;
  provider?: string;
  orientation?: "horizontal" | "vertical" | "square" | "all";
  min_duration?: number;
  max_duration?: number;
  min_motion?: number;
  used_filter?: "all" | "used" | "unused";
  limit?: number;
  offset?: number;
}

export interface FootageSearchResponse {
  results: Shot[];
  total: number;
  query: string;
  model_id: string;
  latency_ms: number;
}

export interface FootageAnalyticsSummary {
  total_shots: number;
  total_assets: number;
  total_duration_hours: number;
  unused_shots_count: number;
  unused_percentage: number;
  providers_breakdown: Record<string, number>;
  orientations_breakdown: Record<string, number>;
  resolutions_breakdown: Record<string, number>;
  duration_histogram: Array<{ bucket: string; count: number }>;
  motion_distribution: Array<{ tier: string; count: number }>;
}

export interface EmbeddingModelInfo {
  id: string;
  name: string;
  version: string;
  dims: number;
  is_default: boolean;
  description: string;
}

export interface DuplicateMember {
  id: string;
  chunk_id: string;
  similarity: number;
  is_keeper: boolean;
  shot: Shot;
}

export interface DuplicateGroup {
  id: string;
  tier: "exact" | "near" | "similar";
  status: "pending" | "merged" | "kept" | "archived";
  suggested_keeper_id?: string;
  created_at?: string;
  members: DuplicateMember[];
}

export interface DuplicateGroupsResponse {
  groups: DuplicateGroup[];
  total: number;
  tier?: string;
}

export interface DuplicateResolutionRequest {
  action: "merge" | "keep" | "archive";
  keeper_id?: string;
  notes?: string;
}

export interface MapCluster {
  id: string;
  model_id: string;
  label: string;
  centroid_x: number;
  centroid_y: number;
  size: number;
}

export interface MapPoint {
  id: string;
  shot_id: string;
  x: number;
  y: number;
  cluster_id?: string;
  cluster_label?: string;
  provider: string;
  resolution?: string;
  orientation: string;
  duration_sec: number;
  motion_score?: number;
  title?: string;
  thumbnail_url?: string;
  storage_url?: string;
}

export interface MapDataResponse {
  model_id: string;
  points: MapPoint[];
  clusters: MapCluster[];
  total: number;
}

export interface Entity {
  id: string;
  name: string;
  aliases: string[];
  entity_type: string;
  notes?: string;
  linked_shots_count: number;
  created_at?: string;
}

export interface EntityCreateRequest {
  name: string;
  aliases?: string[];
  entity_type?: string;
  notes?: string;
}

// --- Phase 4: Selection Debugger, Eval Harness, Curation Queue ---

export interface DebuggerCandidate {
  chunk_id: string;
  media_item_id?: string;
  provider: string;
  title?: string;
  thumbnail_url?: string;
  storage_url?: string;
  score: number;
  motion_mean?: number;
  motion_score?: number;
  duration_sec: number;
  resolution?: string;
  orientation: string;
  is_selected: boolean;
}

export interface DebuggerBeat {
  id: string;
  text: string;
  visual_intent?: string;
  beat_type: string;
  footage_status: string;
  selected_clip_id?: string;
  requery_count: number;
  requery_reason?: string;
  fallback_reason?: string;
  candidates: DebuggerCandidate[];
}

export interface DebuggerJob {
  id: string;
  title?: string;
  stage: string;
  status: string;
  created_at?: string;
  beats: DebuggerBeat[];
}

export interface DebuggerJobListItem {
  id: string;
  title: string;
  stage: string;
  status: string;
  beats_count: number;
  has_candidates: boolean;
  created_at?: string;
}

export interface EvalQueryItem {
  query: string;
  model_a_candidates: DebuggerCandidate[];
  model_b_candidates: DebuggerCandidate[];
  top1_agreement: boolean;
  overlap_count: number;
  latency_a_ms: number;
  latency_b_ms: number;
}

export interface EvalCompareRequest {
  queries: string[];
  model_a?: string;
  model_b?: string;
  top_k?: number;
}

export interface EvalCompareResponse {
  model_a: string;
  model_b: string;
  total_queries: number;
  top1_agreement_rate: number;
  average_overlap_rate: number;
  avg_latency_a_ms: number;
  avg_latency_b_ms: number;
  queries: EvalQueryItem[];
}

export interface CurationQueueItem {
  shot: Shot;
  curation_status: "pending" | "approved" | "rejected";
  tags: string[];
}

export interface CurationQueueResponse {
  items: CurationQueueItem[];
  total: number;
}


