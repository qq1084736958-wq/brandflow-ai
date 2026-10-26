import { NextResponse } from "next/server";
import { CozeRequestError, runCozeWorkflow, unwrapWorkflowOutput } from "@/lib/server/run-coze-workflow";
import { validateGenerateRequest } from "@/lib/server/validate-request";
import { applyRedlineGate } from "@/lib/server/review-redline";

export const runtime = "nodejs";
export const maxDuration = 310;

function fail(message: string, code: string, status: number) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function POST(request: Request) {
  const workflowId = process.env.COZE_REVIEW_WORKFLOW_ID;
  if (!workflowId) return fail("尚未配置独立审核工作流", "REVIEW_WORKFLOW_MISSING", 501);

  try {
    const body = await request.json() as Record<string, unknown>;
    const sourceRequest = validateGenerateRequest(body.request);
    const content = body.content;
    if (content === undefined || content === null) return fail("缺少需要审核的内容", "INVALID_REQUEST", 400);

    const contentText = typeof content === "string" ? content : JSON.stringify(content);
    const parameters = {
      brand_profile: sourceRequest.brand_material,
      content_strategy: [
        sourceRequest.marketing_goal,
        sourceRequest.selected_dir,
        sourceRequest.required_info,
      ].filter(Boolean).join("\n"),
      core_product: sourceRequest.core_product,
      content_type: sourceRequest.output_type,
      platform: sourceRequest.platform,
      content_text: contentText,
      required_info: sourceRequest.required_info || "",
      prohibited_info: sourceRequest.prohibited_info || "",
      additional_req: sourceRequest.additional_req || "",
    };
    const result = unwrapWorkflowOutput(await runCozeWorkflow(workflowId, parameters));
    return NextResponse.json(applyRedlineGate(result, contentText, sourceRequest.prohibited_info || ""));
  } catch (error) {
    if (error instanceof CozeRequestError) return fail(error.message, error.code, error.status);
    return fail(error instanceof Error ? error.message : "重新审核失败", "INVALID_REQUEST", 400);
  }
}
