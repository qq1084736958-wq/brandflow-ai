"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { taskStorage } from "@/lib/storage";
import { normalizeGenerateResult } from "@/lib/result-utils";
import type {
  GenerateRequest,
  GenerationTask,
} from "@/types/brandflow";

const phases = [
  "解析品牌资料",
  "生成内容策略",
  "生成内容",
  "品牌一致性审核",
  "风险修正",
  "完成",
];

const POLL_INTERVAL_MS = 2_000;

export function GenerationProgress() {
  const router = useRouter();
  const started = useRef(false);
  const cancelled = useRef(false);
  const pollTimer = useRef<number | null>(null);
  const [activePhase, setActivePhase] = useState(0);
  const [error, setError] = useState("");
  const [taskId, setTaskId] = useState("");
  const [failedTask, setFailedTask] = useState<GenerationTask | null>(null);

  const completeTask = useCallback((task: GenerationTask) => {
    if (!task.result) throw new Error("任务已完成，但没有返回生成结果");
    const request = task.request;
    taskStorage.saveResult({
      outputType: request.output_type,
      campaignName: request.campaign_name,
      result: normalizeGenerateResult(task.result),
    });
    taskStorage.clearActiveTask(task.id);
    setActivePhase(5);
    window.setTimeout(() => router.replace("/result"), 500);
  }, [router]);

  const pollTask = useCallback(async (id: string) => {
    while (!cancelled.current) {
      try {
        const response = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const task = await response.json() as GenerationTask & {
          error?: string;
        };
        if (!response.ok) {
          if (response.status === 404) taskStorage.clearActiveTask(id);
          throw new Error(task.error || "读取任务状态失败");
        }
        if (task.status === "succeeded") {
          completeTask(task);
          return;
        }
        if (task.status === "failed") {
          setFailedTask(task);
          throw new Error(task.error || "生成失败，请稍后重试");
        }
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "生成失败，请稍后重试",
        );
        return;
      }

      await new Promise<void>((resolve) => {
        pollTimer.current = window.setTimeout(resolve, POLL_INTERVAL_MS);
      });
    }
  }, [completeTask]);

  const createTask = useCallback(async (request: GenerateRequest) => {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const data = await response.json() as {
      task_id?: string;
      error?: string;
    };
    if (!response.ok || !data.task_id) {
      throw new Error(data.error || "无法创建生成任务");
    }
    taskStorage.saveActiveTask(data.task_id);
    setTaskId(data.task_id);
    await pollTask(data.task_id);
  }, [pollTask]);

  const startOrResume = useCallback(async (forceNew = false) => {
    setError("");
    setFailedTask(null);
    setActivePhase(0);

    const existingId = forceNew ? null : taskStorage.getActiveTask();
    if (existingId) {
      setTaskId(existingId);
      await pollTask(existingId);
      return;
    }

    const request = taskStorage.getRequest();
    if (!request) {
      router.replace("/");
      return;
    }
    await createTask(request);
  }, [createTask, pollTask, router]);

  const retry = useCallback(() => {
    if (taskId) taskStorage.clearActiveTask(taskId);
    window.location.reload();
  }, [taskId]);

  useEffect(() => {
    cancelled.current = false;
    if (!started.current) {
      started.current = true;
      void startOrResume();
    }
    return () => {
      cancelled.current = true;
    };
  }, [startOrResume]);

  useEffect(() => {
    if (error || activePhase === 5) return;
    const timer = window.setInterval(
      () => setActivePhase((current) => Math.min(current + 1, 4)),
      4_500,
    );
    return () => window.clearInterval(timer);
  }, [error, activePhase]);

  return (
    <div className="panel overflow-hidden">
      <div className="border-b border-line bg-slate-50/70 px-5 py-5 sm:px-7">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-indigo-50 text-primary">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h2 className="text-base font-semibold">品牌内容工作流运行中</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              任务正在服务端后台运行，通常需要 1–3 分钟。
            </p>
            {taskId && (
              <p className="mt-1 break-all text-xs text-slate-400">
                任务编号：{taskId}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        {error ? (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-5">
            <div className="flex gap-3">
              <AlertCircle className="shrink-0 text-rose-600" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-rose-900">生成未完成</h3>
                <p className="mt-1 text-sm leading-6 text-rose-800">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={retry}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-50"
            >
              <RotateCcw size={15} />重新执行
            </button>
            {failedTask && (
              <details className="mt-4 rounded-lg border border-rose-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-rose-800">
                  查看失败日志
                </summary>
                <div className="border-t border-rose-100 px-4 py-3">
                  {failedTask.errorCode && (
                    <p className="mb-3 text-xs font-medium text-rose-700">
                      错误代码：{failedTask.errorCode}
                    </p>
                  )}
                  <ol className="space-y-3">
                    {(failedTask.logs ?? []).map((log, index) => (
                      <li key={`${log.timestamp}-${index}`} className="text-xs leading-5 text-slate-600">
                        <span className="font-semibold text-slate-800">
                          {log.stage}
                        </span>
                        {" · "}
                        {new Date(log.timestamp).toLocaleString("zh-CN")}
                        <span className="mt-0.5 block">{log.message}</span>
                        {log.code && (
                          <span className="block text-rose-700">代码：{log.code}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              </details>
            )}
          </div>
        ) : (
          <ol aria-label="生成进度" className="space-y-1">
            {phases.map((phase, index) => {
              const active = index === activePhase;
              const passed = index < activePhase;
              return (
                <li
                  key={phase}
                  className={`flex items-center gap-4 rounded-lg px-3 py-3.5 ${
                    active ? "bg-indigo-50/70" : ""
                  }`}
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-semibold ${
                    active
                      ? "border-primary bg-primary text-white"
                      : passed
                        ? "border-indigo-200 bg-indigo-50 text-primary"
                        : "border-line bg-white text-slate-400"
                  }`}>
                    {active
                      ? <LoaderCircle className="animate-spin" size={16} />
                      : index + 1}
                  </span>
                  <span className={
                    active
                      ? "text-sm font-semibold text-ink"
                      : passed
                        ? "text-sm text-muted"
                        : "text-sm text-slate-400"
                  }>
                    {phase}
                  </span>
                  {active && (
                    <span className="ml-auto text-xs font-medium text-primary">
                      处理中
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        <p className="mt-6 border-t border-line pt-5 text-xs leading-5 text-muted">
          可以安全关闭此页面。重新打开 BrandFlow 后可恢复任务。阶段动画仅表示等待状态，
          不代表 Coze 内部节点已经逐项完成；最终状态以服务端返回结果为准。
        </p>
      </div>
    </div>
  );
}
