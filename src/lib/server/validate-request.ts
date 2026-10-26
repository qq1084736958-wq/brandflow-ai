import type { GenerateRequest, OutputType } from "@/types/brandflow";
import { LONG_TEXT_LIMITS, type LongTextField } from "../input-limits";

const requiredFields = ["brand_name", "industry", "brand_material", "campaign_name", "marketing_goal", "core_product", "platform"] as const;
const optionalFields = ["selected_dir", "required_info", "prohibited_info", "additional_req"] as const;

function textField(source: Record<string, unknown>, key: string, required = false): string {
  const value = source[key];
  if (typeof value !== "string") {
    if (!required && value === undefined) return "";
    throw new Error(`${key} 格式不正确`);
  }
  const clean = value.trim();
  if (required && !clean) throw new Error(`${key} 不能为空`);
  const configuredLimit = LONG_TEXT_LIMITS[key as LongTextField]?.max;
  const maximumLength = configuredLimit ?? 5000;
  if (clean.length > maximumLength) {
    throw new Error(`${key} 最多允许输入 ${maximumLength} 个字符`);
  }
  return clean;
}

function videoDurationField(source: Record<string, unknown>): string {
  const raw = textField(source, "video_duration", true);
  const normalized = raw.replace(/\s*秒$/, "");
  if (!["15", "30", "60", "90"].includes(normalized)) {
    throw new Error("video_duration 必须为 15、30、60 或 90 秒");
  }
  return normalized;
}

export function validateGenerateRequest(value: unknown): GenerateRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("请求内容格式不正确");
  const source = value as Record<string, unknown>;
  const output = source.output_type;
  if (output !== "social" && output !== "video") throw new Error("output_type 必须为 social 或 video");
  const request = { output_type: output as OutputType } as GenerateRequest;
  for (const field of requiredFields) request[field] = textField(source, field, true);
  for (const field of optionalFields) request[field] = textField(source, field);

  if (output === "social") {
    const count = Number(source.content_count);
    if (!Number.isInteger(count) || count < 1 || count > 10) throw new Error("content_count 必须为 1–10 的整数");
    request.content_count = count;
  } else {
    request.video_duration = videoDurationField(source);
    request.video_format = textField(source, "video_format", true);
  }
  return request;
}
