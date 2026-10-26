import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  GenerateRequest,
  GenerationTask,
  GenerationTaskLog,
  GenerationTaskStatus,
} from "@/types/brandflow";

const TASK_ID_PATTERN = /^task_[a-f0-9-]+$/;

function taskDirectory() {
  return process.env.BRANDFLOW_TASK_DATA_DIR
    ? path.resolve(process.env.BRANDFLOW_TASK_DATA_DIR)
    : path.join(process.cwd(), ".brandflow-data", "tasks");
}

function taskPath(id: string) {
  if (!TASK_ID_PATTERN.test(id)) throw new Error("任务 ID 格式不正确");
  return path.join(taskDirectory(), `${id}.json`);
}

async function persistTask(task: GenerationTask) {
  await mkdir(taskDirectory(), { recursive: true });
  await writeFile(taskPath(task.id), JSON.stringify(task, null, 2), "utf8");
}

export async function createGenerationTask(request: GenerateRequest) {
  const now = new Date().toISOString();
  const task: GenerationTask = {
    id: `task_${randomUUID()}`,
    status: "queued",
    request,
    logs: [{
      timestamp: now,
      stage: "queued",
      level: "info",
      message: "任务已创建，等待服务端执行",
    }],
    createdAt: now,
    updatedAt: now,
  };
  await persistTask(task);
  return task;
}

export async function getGenerationTask(id: string): Promise<GenerationTask | null> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return JSON.parse(await readFile(taskPath(id), "utf8")) as GenerationTask;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      const isTransientPartialWrite = error instanceof SyntaxError && attempt < 5;
      if (!isTransientPartialWrite) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  return null;
}

export async function updateGenerationTask(
  id: string,
  patch: Partial<Pick<GenerationTask, "status" | "result" | "error" | "errorCode">>,
) {
  const current = await getGenerationTask(id);
  if (!current) throw new Error("任务不存在");
  const task: GenerationTask = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await persistTask(task);
  return task;
}

export async function appendGenerationTaskLog(
  id: string,
  log: Omit<GenerationTaskLog, "timestamp">,
) {
  const current = await getGenerationTask(id);
  if (!current) throw new Error("任务不存在");
  const task: GenerationTask = {
    ...current,
    logs: [
      ...(current.logs ?? []),
      { ...log, timestamp: new Date().toISOString() },
    ],
    updatedAt: new Date().toISOString(),
  };
  await persistTask(task);
  return task;
}

export async function listGenerationTasks(limit = 20) {
  try {
    const names = await readdir(taskDirectory());
    const tasks = await Promise.all(
      names
        .filter((name) => /^task_[a-f0-9-]+\.json$/.test(name))
        .map((name) => getGenerationTask(name.replace(/\.json$/, ""))),
    );
    return tasks
      .filter((task): task is GenerationTask => Boolean(task))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(1, Math.min(limit, 100)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export function isRecoverableTaskStatus(status: GenerationTaskStatus) {
  return status === "queued" || status === "running";
}
