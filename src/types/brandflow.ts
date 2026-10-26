export type OutputType = "social" | "video";

export interface BrandAsset {
  id: string;
  name: string;
  kind: "logo" | "product" | "store" | "reference";
  mediaType: "image" | "video" | "document";
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  description: string;
  confirmed: boolean;
}

export interface GenerateRequest {
  brand_name: string;
  industry: string;
  brand_material: string;
  campaign_name: string;
  marketing_goal: string;
  core_product: string;
  platform: string;
  output_type: OutputType;
  content_count?: number;
  video_duration?: string;
  video_format?: string;
  selected_dir?: string;
  required_info?: string;
  prohibited_info?: string;
  additional_req?: string;
  brand_assets?: BrandAsset[];
}

export interface GenerateResult {
  final_content: unknown;
  review_result: unknown;
  revision_result: unknown;
  risk_level: unknown;
  review_report: unknown;
  human_review_req: unknown;
  [key: string]: unknown;
}

export type GenerationTaskStatus = "queued" | "running" | "succeeded" | "failed";

export interface GenerationTaskLog {
  timestamp: string;
  stage: "queued" | "summary" | "workflow" | "post_review" | "completed";
  level: "info" | "warning" | "error";
  message: string;
  code?: string;
}

export interface GenerationTask {
  id: string;
  status: GenerationTaskStatus;
  request: GenerateRequest;
  result?: GenerateResult;
  error?: string;
  errorCode?: string;
  logs: GenerationTaskLog[];
  createdAt: string;
  updatedAt: string;
}

export interface StoredResult {
  outputType: OutputType;
  campaignName: string;
  result: GenerateResult;
}

export interface StoredDraft {
  campaignName: string;
  outputType: OutputType;
  content: unknown;
  savedAt: string;
}

export interface ItemActionRequest {
  action: "regenerate" | "revise";
  contentId: string;
  instruction?: string;
  item: unknown;
  request: GenerateRequest;
}

export interface ReReviewRequest {
  content: unknown;
  request: GenerateRequest;
}

export interface VisualAsset {
  id: string;
  url: string;
  thumbnailUrl?: string;
  source: string;
  license: string;
  attribution?: string;
  prompt?: string;
}
