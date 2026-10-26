import { describe, expect, it } from "vitest";
import { applyRedlineGate } from "../src/lib/server/review-redline";

describe("重新审核红线兜底", () => {
  it("命中绝对化和医疗功效表达时强制阻断", () => {
    const result = applyRedlineGate(
      { review_result: "approved", risk_level: "low", review_report: { issues: [] } },
      JSON.stringify({ contents: [{ content_id: "content_01", body: "全网第一，保证治疗疲劳" }] }),
      "禁止全网第一、治疗疲劳",
    );
    expect(result).toMatchObject({
      review_result: "blocked",
      revision_result: "blocked_need_human",
      risk_level: "high",
      human_review_req: "yes",
    });
    const report = result.review_report as { issues: unknown[] };
    expect(report.issues.length).toBeGreaterThan(0);
  });

  it("未命中红线时保留 Coze 结果", () => {
    const input = { review_result: "approved", risk_level: "low" };
    expect(applyRedlineGate(input, "自然通勤文案", "")).toBe(input);
  });
});
