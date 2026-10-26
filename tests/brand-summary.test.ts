import { afterEach, describe, expect, it, vi } from "vitest";
import type { GenerateRequest } from "@/types/brandflow";
import {
  BRAND_SUMMARY_THRESHOLD,
  extractBrandSummary,
  prepareBrandSummary,
  shouldSummarizeBrandMaterial,
} from "../src/lib/server/brand-summary";

const baseRequest: GenerateRequest = {
  brand_name: "测试品牌",
  industry: "测试行业",
  brand_material: "品牌资料",
  campaign_name: "测试活动",
  marketing_goal: "提升认知",
  core_product: "已确认产品资料",
  platform: "小红书",
  output_type: "social",
  content_count: 1,
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("brand summary", () => {
  it("仅在资料超过阈值时触发摘要", () => {
    expect(shouldSummarizeBrandMaterial("品".repeat(BRAND_SUMMARY_THRESHOLD))).toBe(false);
    expect(shouldSummarizeBrandMaterial("品".repeat(BRAND_SUMMARY_THRESHOLD + 1))).toBe(true);
  });

  it("读取摘要工作流的 summary 字段", () => {
    expect(extractBrandSummary({ summary: "  压缩后的资料  " })).toBe("压缩后的资料");
    expect(extractBrandSummary({ output: JSON.stringify({ summary: "嵌套摘要" }) })).toBe("嵌套摘要");
  });

  it("短资料保持原样且不依赖摘要工作流配置", async () => {
    vi.stubEnv("COZE_SUMMARY_WORKFLOW_ID", "");
    const outcome = await prepareBrandSummary(baseRequest);

    expect(outcome.applied).toBe(false);
    expect(outcome.warning).toBeUndefined();
    expect(outcome.request).toBe(baseRequest);
  });

  it("长资料在缺少摘要工作流配置时安全回退", async () => {
    vi.stubEnv("COZE_SUMMARY_WORKFLOW_ID", "");
    const request = {
      ...baseRequest,
      brand_material: "品".repeat(BRAND_SUMMARY_THRESHOLD + 1),
    };
    const outcome = await prepareBrandSummary(request);

    expect(outcome.applied).toBe(false);
    expect(outcome.warning).toBe(true);
    expect(outcome.code).toBe("SUMMARY_WORKFLOW_MISSING");
    expect(outcome.request.brand_material).toBe(request.brand_material);
  });
});
