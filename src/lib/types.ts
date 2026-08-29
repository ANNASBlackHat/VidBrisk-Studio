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
  };
}

export interface JobCreateRequest {
  title?: string;
  raw_input?: string;
  script?: string;
  prompt?: string;
  voice_type?: "tts" | "custom" | string;
  tts_provider?: "kokoro" | "supersonic" | "chatterbox" | "custom" | "mock" | string;
  aligner_provider?: "easytranscriber" | "whisperx" | "mock" | string;
  target_orientation?: TargetOrientation;
  auto_approve?: boolean;
  single_pass_llm?: boolean;
  audio_file?: File | Blob;
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
}

export interface JobSummaryResponse {
  id: string;
  title?: string | null;
  stage: JobStage;
  status: JobStatus;
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
