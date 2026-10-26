import { NextResponse } from "next/server";
import { ensureGenerationTaskRunning } from "@/lib/server/generation-task-runner";
import { createGenerationTask } from "@/lib/server/task-store";
import { validateGenerateRequest } from "@/lib/server/validate-request";

export const runtime = "nodejs";

function errorResponse(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(request: Request) {
  let parameters;
  try {
    parameters = validateGenerateRequest(await request.json());
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "请求参数不正确",
      "INVALID_REQUEST",
      400,
    );
  }

  try {
    const task = await createGenerationTask(parameters);
    ensureGenerationTaskRunning(task.id);
    return NextResponse.json(
      { task_id: task.id, status: task.status },
      { status: 202 },
    );
  } catch {
    return errorResponse("无法创建生成任务，请稍后重试", "TASK_CREATE_FAILED", 500);
  }
}
