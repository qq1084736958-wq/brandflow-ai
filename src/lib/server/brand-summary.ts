import type { GenerateRequest } from "@/types/brandflow";
import {
  CozeRequestError,
  runCozeWorkflow,
  unwrapWorkflowOutput,
} from "./run-coze-workflow";

export const BRAND_SUMMARY_THRESHOLD = 2_000;
const MINIMUM_USEFUL_SUMMARY_LENGTH = 100;

export interface BrandSummaryOutcome {
  request: GenerateRequest;
  applied: boolean;
  message: string;
  warning?: boolean;
  code?: string;
}

export function shouldSummarizeBrandMaterial(material: string) {
  return material.trim().length > BRAND_SUMMARY_THRESHOLD;
}

export function extractBrandSummary(value: Record<string, unknown>) {
  const unwrapped = unwrapWorkflowOutput(value);
  const candidates = [
    unwrapped.summary,
    unwrapped.brand_summary,
    unwrapped.output,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

export async function prepareBrandSummary(
  request: GenerateRequest,
): Promise<BrandSummaryOutcome> {
  const original = request.brand_material.trim();
  if (!shouldSummarizeBrandMaterial(original)) {
    return {
      request,
      applied: false,
      message: `品牌资料共 ${original.length} 字，未达到智能摘要阈值`,
    };
  }

  const workflowId = process.env.COZE_SUMMARY_WORKFLOW_ID;
  if (!workflowId) {
    return {
      request,
      applied: false,
      warning: true,
      code: "SUMMARY_WORKFLOW_MISSING",
      message: "品牌资料超过摘要阈值，但服务端未配置摘要工作流，已回退使用原始资料",
    };
  }

  try {
    const summary = extractBrandSummary(
      await runCozeWorkflow(workflowId, {
        brand_name: request.brand_name,
        industry: request.industry,
        brand_material: original,
      }),
    );

    if (
      summary.length < MINIMUM_USEFUL_SUMMARY_LENGTH
      || summary.length >= original.length
    ) {
      return {
        request,
        applied: false,
        warning: true,
        code: "SUMMARY_NOT_USEFUL",
        message: "摘要工作流已返回，但摘要为空、过短或没有减少上下文，已回退使用原始资料",
      };
    }

    return {
      request: {
        ...request,
        brand_material: summary,
      },
      applied: true,
      message: `品牌资料已由 ${original.length} 字压缩为 ${summary.length} 字`,
    };
  } catch (error) {
    return {
      request,
      applied: false,
      warning: true,
      code: error instanceof CozeRequestError
        ? error.code
        : "SUMMARY_FAILED",
      message: `品牌资料摘要失败，已回退使用原始资料：${
        error instanceof Error ? error.message : "未知错误"
      }`,
    };
  }
}
