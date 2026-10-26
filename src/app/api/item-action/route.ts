import { NextResponse } from "next/server";
import {
  CozeRequestError,
  runCozeWorkflow,
  unwrapWorkflowOutput,
} from "@/lib/server/run-coze-workflow";
import { validateGenerateRequest } from "@/lib/server/validate-request";

export const runtime = "nodejs";
export const maxDuration = 310;

function fail(message: string, code: string, status: number) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function POST(request: Request) {
  const workflowId = process.env.COZE_ITEM_REVISE_WORKFLOW_ID;
  if (!workflowId) {
    return fail("服务端尚未配置 Coze 单篇修改工作流", "CONFIG_MISSING", 500);
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const source = validateGenerateRequest(body.request);
    const action = body.action;
    const contentId = String(body.contentId || "").trim();

    if ((action !== "regenerate" && action !== "revise") || !contentId) {
      return fail("单篇操作参数不正确", "INVALID_REQUEST", 400);
    }

    const originalContent = typeof body.item === "string"
      ? body.item
      : JSON.stringify(body.item ?? {});
    const requestedInstruction = String(body.instruction || "").trim();
    const instruction = action === "regenerate"
      ? [
          "重新生成这一个内容条目，返回完整替代版本。",
          "保留 content_id、已确认产品事实和原有内容结构，不生成其他条目。",
          requestedInstruction,
        ].filter(Boolean).join("\n")
      : requestedInstruction || "仅修改存在风险或表达不清的部分，其他字段保持不变。";

    const parameters: Record<string, unknown> = {
      content_id: contentId,
      output_type: source.output_type,
      original_content: originalContent,
      instruction,
      brand_profile: source.brand_material,
      core_product: source.core_product,
      platform: source.platform,
      required_info: source.required_info || "",
      prohibited_info: source.prohibited_info || "",
      additional_req: [
        source.additional_req,
        source.selected_dir ? `指定内容方向：${source.selected_dir}` : "",
        `活动名称：${source.campaign_name}`,
        `营销目标：${source.marketing_goal}`,
      ].filter(Boolean).join("\n"),
    };

    const result = unwrapWorkflowOutput(
      await runCozeWorkflow(workflowId, parameters),
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CozeRequestError) {
      return fail(error.message, error.code, error.status);
    }
    return fail(
      error instanceof Error ? error.message : "单篇处理失败",
      "INVALID_REQUEST",
      400,
    );
  }
}
