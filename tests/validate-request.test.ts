import { describe, expect, it } from "vitest";
import { validateGenerateRequest } from "../src/lib/server/validate-request";

const base = {
  brand_name: "澄野咖啡", industry: "咖啡零售", brand_material: "品牌资料",
  campaign_name: "冷萃上新", marketing_goal: "新品认知", core_product: "冷萃咖啡",
  platform: "小红书", output_type: "social", content_count: 3,
};

describe("validateGenerateRequest", () => {
  it("仅保留工作流需要的白名单字段", () => {
    expect(validateGenerateRequest({ ...base, token: "secret" })).toEqual({
      ...base, selected_dir: "", required_info: "", prohibited_info: "", additional_req: "",
    });
  });

  it("校验 video 条件字段", () => {
    expect(() => validateGenerateRequest({ ...base, output_type: "video", content_count: undefined })).toThrow("video_duration");
  });

  it("将界面的视频时长转换为工作流可接受的数字字符串", () => {
    expect(validateGenerateRequest({
      ...base,
      output_type: "video",
      content_count: undefined,
      video_duration: "30秒",
      video_format: "9:16 竖屏",
    }).video_duration).toBe("30");
  });

  it("校验 social 内容数量", () => {
    expect(() => validateGenerateRequest({ ...base, content_count: 0 })).toThrow("content_count");
  });

  it("拒绝超过长文本字段上限的输入", () => {
    expect(() => validateGenerateRequest({
      ...base,
      brand_material: "品".repeat(3001),
    })).toThrow("brand_material 最多允许输入 3000 个字符");
  });

  it("接受长文本字段上限内的输入", () => {
    expect(validateGenerateRequest({
      ...base,
      brand_material: "品".repeat(3000),
    }).brand_material).toHaveLength(3000);
  });
});
