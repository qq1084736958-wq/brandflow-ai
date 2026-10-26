import { describe, expect, it } from "vitest";
import { mergePostRevisionReview } from "../src/lib/server/post-revision-review";
import type { GenerateResult } from "../src/types/brandflow";

const generated: GenerateResult = {
  final_content: { body: "修改后的内容" },
  review_result: "needs_revision",
  revision_result: "revised",
  risk_level: "medium",
  review_report: {},
  human_review_req: "yes",
  changes: [{ original_text: "原文", revised_text: "修改后" }],
};

describe("post revision review gate", () => {
  it("allows only approved low-risk content into the final result", () => {
    const result = mergePostRevisionReview(generated, {
      review_result: "approved",
      risk_level: "low",
      human_review_req: "no",
      review_report: { issue_count: 0, issues: [] },
    });
    expect(result.status).toBe("success");
    expect(result.revision_result).toBe("revised");
    expect(result.human_review_req).toBe("no");
  });

  it("routes remaining risk to human review and blocks publishing", () => {
    const result = mergePostRevisionReview(generated, {
      review_result: "needs_revision",
      risk_level: "medium",
      review_report: { issue_count: 1 },
    });
    expect(result.status).toBe("partial_success");
    expect(result.revision_result).toBe("blocked_need_human");
    expect(result.human_review_req).toBe("yes");
  });
});
