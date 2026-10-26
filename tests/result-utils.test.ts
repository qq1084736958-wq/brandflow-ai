import { describe, expect, it } from "vitest";
import { normalizeGenerateResult, parsePossibleJson } from "../src/lib/result-utils";

describe("result normalization", () => {
  it("递归解析多层 JSON 字符串", () => {
    expect(parsePossibleJson(JSON.stringify(JSON.stringify({ ok: true })))).toEqual({ ok: true });
  });

  it("兼容会话中已经保存的双重编码工作流结果", () => {
    const finalResult = {
      final_content: { scenes: [{ scene_no: 1 }] },
      review_result: "blocked",
      revision_result: "revised",
      risk_level: "high",
      review_report: "{}",
      human_review_req: "yes",
    };

    expect(normalizeGenerateResult({
      output: JSON.stringify(JSON.stringify(finalResult)),
    })).toEqual(finalResult);
  });
});
