import type { GenerateResult } from "@/types/brandflow";
import { prepareBrandSummary } from "./brand-summary";
import { runPostRevisionReview } from "./post-revision-review";
import {
  CozeRequestError,
  runCozeWorkflow,
  unwrapWorkflowOutput,
} from "./run-coze-workflow";
import {
  appendGenerationTaskLog,
  getGenerationTask,
  isRecoverableTaskStatus,
  updateGenerationTask,
} from "./task-store";

declare global {
  var __brandflowRunningTaskIds: Set<string> | undefined;
}

const runningTaskIds =
  globalThis.__brandflowRunningTaskIds ??= new Set<string>();

async function executeGenerationTask(id: string) {
  const task = await getGenerationTask(id);
  if (!task || !isRecoverableTaskStatus(task.status)) return;

  const workflowId = process.env.COZE_WORKFLOW_ID;
  if (!workflowId) {
    await updateGenerationTask(id, {
      status: "failed",
      error: "服务端尚未配置 Coze 主工作流",
      errorCode: "CONFIG_MISSING",
    });
    await appendGenerationTaskLog(id, {
      stage: "workflow",
      level: "error",
      message: "服务端尚未配置 Coze 主工作流",
      code: "CONFIG_MISSING",
    });
    return;
  }

  await updateGenerationTask(id, {
    status: "running",
    error: undefined,
    errorCode: undefined,
  });
  await appendGenerationTaskLog(id, {
    stage: "workflow",
    level: "info",
    message: "开始调用 Coze 主工作流",
  });

  try {
    const summary = await prepareBrandSummary(task.request);
    await appendGenerationTaskLog(id, {
      stage: "summary",
      level: summary.warning ? "warning" : "info",
      message: summary.message,
      code: summary.code,
    });

    const generated = unwrapWorkflowOutput(
      await runCozeWorkflow(
        workflowId,
        summary.request as unknown as Record<string, unknown>,
      ),
    ) as GenerateResult;
    await appendGenerationTaskLog(id, {
      stage: "post_review",
      level: "info",
      message: "主工作流已返回，开始执行修改后复审与风险闸门",
    });
    const postReview = await runPostRevisionReview(generated, task.request);
    await appendGenerationTaskLog(id, {
      stage: "post_review",
      level: postReview.warning ? "warning" : "info",
      message: postReview.message,
      code: postReview.code,
    });
    await updateGenerationTask(id, {
      status: "succeeded",
      result: postReview.result,
      error: undefined,
      errorCode: undefined,
    });
    await appendGenerationTaskLog(id, {
      stage: "completed",
      level: "info",
      message: "Coze 工作流已完成，结果解析成功",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成失败，请稍后重试";
    const code = error instanceof CozeRequestError
      ? error.code
      : "UNKNOWN_ERROR";
    await updateGenerationTask(id, {
      status: "failed",
      error: message,
      errorCode: code,
    });
    await appendGenerationTaskLog(id, {
      stage: "workflow",
      level: "error",
      message,
      code,
    });
  }
}

export function ensureGenerationTaskRunning(id: string) {
  if (runningTaskIds.has(id)) return;
  runningTaskIds.add(id);
  void executeGenerationTask(id).finally(() => runningTaskIds.delete(id));
}
