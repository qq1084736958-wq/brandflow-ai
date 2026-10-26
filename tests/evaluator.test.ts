// @ts-expect-error JavaScript evaluator intentionally has no declaration file.
import { evaluateCase, summarizeEvaluations } from "../evals/evaluator.mjs";
import { describe, expect, it } from "vitest";

const baseCase = {
  id: "BF-T001",
  category: "test",
  riskPressure: "low",
  expectedAction: "deliver",
  requiredTerms: ["A5"],
  forbiddenTerms: ["永久不透墨"],
};

describe("evaluation harness", () => {
  it("scores an approved grounded result as correct", () => {
    const item = evaluateCase(baseCase, {
      status: "succeeded",
      result: {
        final_content: "A5笔记本，支持180度平摊。",
        review_result: "approved",
        risk_level: "low",
        human_review_req: "no",
        revision_result: "no_change",
      },
    });
    expect(item.checks.decisionCorrect).toBe(1);
    expect(item.checks.forbiddenHits).toEqual([]);
    expect(item.averageScore).toBe(5);
  });

  it("marks leaked forbidden claims as a badcase", () => {
    const item = evaluateCase(baseCase, {
      status: "succeeded",
      result: {
        final_content: "A5笔记本永久不透墨。",
        review_result: "approved",
        risk_level: "low",
        human_review_req: "no",
        revision_result: "no_change",
      },
    });
    expect(item.checks.forbiddenHits).toEqual(["永久不透墨"]);
    expect(item.badcase).toBe(true);
  });

  it("aggregates completion and decision metrics", () => {
    const good = evaluateCase(baseCase, {
      status: "succeeded",
      result: { final_content: "A5笔记本", review_result: "approved", risk_level: "low", human_review_req: "no" },
    });
    const summary = summarizeEvaluations([good]);
    expect(summary.sampleSize).toBe(1);
    expect(summary.completionRate).toBe(1);
    expect(summary.badcaseCount).toBe(0);
  });
});
