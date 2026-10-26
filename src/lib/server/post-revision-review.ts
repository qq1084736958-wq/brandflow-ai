import type { GenerateRequest, GenerateResult } from "@/types/brandflow";
import { applyRedlineGate } from "./review-redline";
import {
  CozeRequestError,
  runCozeWorkflow,
  unwrapWorkflowOutput,
} from "./run-coze-workflow";

interface PostReviewOutcome {
  result: GenerateResult;
  message: string;
  warning?: boolean;
  code?: string;
}

function normalized(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function blockForReviewFailure(
  result: GenerateResult,
  message: string,
): GenerateResult {
  return {
    ...result,
    status: "partial_success",
    review_result: "blocked",
    revision_result: "blocked_need_human",
    risk_level: "high",
    human_review_req: "yes",
    review_report: {
      summary: "修改后的内容未能完成复审，系统已按安全策略阻断直接发布。",
      overall_score: 0,
      issue_count: 1,
      dimension_scores: {},
      issues: [{
        issue_id: "post_review_failed",
        severity: "high",
        risk_type: "review_incomplete",
        location: "final_content",
        original_text: "",
        problem: message,
        basis: "自动修改后的内容必须通过独立复审后才能进入最终结果。",
        suggestion: "请重新执行复审；若仍失败，请转交人工审核。",
      }],
      passed_checks: [],
      revision_brief: "修改后复审未完成，等待人工处理。",
    },
  };
}

export function mergePostRevisionReview(
  generated: GenerateResult,
  reviewed: Record<string, unknown>,
): GenerateResult {
  const reviewResult = normalized(reviewed.review_result) || "blocked";
  const riskLevel = normalized(reviewed.risk_level) || "high";
  const approved = reviewResult === "approved" && riskLevel === "low";

  return {
    ...generated,
    status: approved ? "success" : "partial_success",
    review_result: approved
      ? "approved"
      : reviewResult === "approved"
        ? "needs_revision"
        : reviewResult,
    revision_result: approved
      ? generated.revision_result
      : "blocked_need_human",
    risk_level: riskLevel,
    human_review_req: approved ? "no" : "yes",
    review_report: reviewed.review_report ?? reviewed,
  };
}

export async function runPostRevisionReview(
  generated: GenerateResult,
  request: GenerateRequest,
): Promise<PostReviewOutcome> {
  const content = generated.final_content;
  const contentText = typeof content === "string"
    ? content
    : JSON.stringify(content ?? {});
  const redlineChecked = applyRedlineGate(
    generated,
    contentText,
    request.prohibited_info || "",
  ) as GenerateResult;

  if (normalized(redlineChecked.revision_result) !== "revised") {
    return {
      result: redlineChecked,
      message: "主工作流结果无需执行修改后复审，已完成服务端红线检查",
    };
  }

  const workflowId = process.env.COZE_REVIEW_WORKFLOW_ID;
  if (!workflowId) {
    return {
      result: blockForReviewFailure(
        redlineChecked,
        "服务端未配置独立复审工作流。",
      ),
      message: "独立复审工作流未配置，结果已转入人工审核",
      warning: true,
      code: "REVIEW_WORKFLOW_MISSING",
    };
  }

  const parameters = {
    brand_profile: request.brand_material,
    content_strategy: [
      request.marketing_goal,
      request.selected_dir,
      request.required_info,
    ].filter(Boolean).join("\n"),
    core_product: request.core_product,
    content_type: request.output_type,
    platform: request.platform,
    content_text: contentText,
    required_info: request.required_info || "",
    prohibited_info: request.prohibited_info || "",
    additional_req: request.additional_req || "",
  };

  try {
    const reviewed = applyRedlineGate(
      unwrapWorkflowOutput(await runCozeWorkflow(workflowId, parameters)),
      contentText,
      request.prohibited_info || "",
    );
    const result = mergePostRevisionReview(redlineChecked, reviewed);
    const approved =
      normalized(result.review_result) === "approved" &&
      normalized(result.risk_level) === "low";
    return {
      result,
      message: approved
        ? "修改后复审通过，内容可以进入最终结果"
        : "修改后复审未通过，内容已转入人工审核并阻断复制",
      warning: !approved,
    };
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "修改后复审执行失败";
    return {
      result: blockForReviewFailure(redlineChecked, message),
      message: `修改后复审失败：${message}`,
      warning: true,
      code: error instanceof CozeRequestError
        ? error.code
        : "POST_REVIEW_FAILED",
    };
  }
}
