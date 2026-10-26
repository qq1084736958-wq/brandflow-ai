import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createGenerationTask,
  getGenerationTask,
  listGenerationTasks,
  updateGenerationTask,
} from "../src/lib/server/task-store";
import type { GenerateRequest } from "../src/types/brandflow";

const request: GenerateRequest = {
  brand_name: "AERI",
  industry: "家居照明",
  brand_material: "现代、简洁、可靠",
  campaign_name: "桌面焕新",
  marketing_goal: "提升产品认知",
  core_product: "AERI Fold 折叠桌面灯",
  platform: "小红书",
  output_type: "social",
  content_count: 1,
};

let dataDirectory = "";

beforeEach(async () => {
  dataDirectory = await mkdtemp(path.join(tmpdir(), "brandflow-task-test-"));
  process.env.BRANDFLOW_TASK_DATA_DIR = dataDirectory;
});

afterEach(async () => {
  delete process.env.BRANDFLOW_TASK_DATA_DIR;
  await rm(dataDirectory, { recursive: true, force: true });
});

describe("generation task store", () => {
  it("persists and updates a generation task", async () => {
    const created = await createGenerationTask(request);
    expect(created.status).toBe("queued");

    const running = await updateGenerationTask(created.id, {
      status: "running",
    });
    expect(running.status).toBe("running");

    const stored = await getGenerationTask(created.id);
    expect(stored?.request.brand_name).toBe("AERI");
    expect(stored?.status).toBe("running");

    const tasks = await listGenerationTasks();
    expect(tasks.map((task) => task.id)).toContain(created.id);
  });

  it("rejects unsafe task identifiers", async () => {
    await expect(getGenerationTask("../outside")).rejects.toThrow(
      "任务 ID 格式不正确",
    );
  });
});
