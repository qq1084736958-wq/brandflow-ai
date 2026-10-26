import { NextResponse } from "next/server";
import { ensureGenerationTaskRunning } from "@/lib/server/generation-task-runner";
import {
  getGenerationTask,
  isRecoverableTaskStatus,
} from "@/lib/server/task-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const task = await getGenerationTask(id);
    if (!task) {
      return NextResponse.json(
        { error: "任务不存在或已被清理", code: "TASK_NOT_FOUND" },
        { status: 404 },
      );
    }
    if (isRecoverableTaskStatus(task.status)) {
      ensureGenerationTaskRunning(task.id);
    }
    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "读取任务失败",
        code: "TASK_READ_FAILED",
      },
      { status: 400 },
    );
  }
}
