"use client";

import Link from "next/link";
import { Archive, ArrowRight, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { taskStorage } from "@/lib/storage";
import type { GenerationTaskStatus } from "@/types/brandflow";

interface ActiveTaskState {
  id: string;
  status: GenerationTaskStatus;
}

function useActiveTask() {
  const [task, setTask] = useState<ActiveTaskState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = taskStorage.getActiveTask();
    if (!id) return;

    async function refresh() {
      try {
        const response = await fetch(`/api/tasks/${encodeURIComponent(id!)}`, {
          cache: "no-store",
        });
        if (response.status === 404) {
          taskStorage.clearActiveTask(id!);
          if (!cancelled) setTask(null);
          return;
        }
        const data = await response.json() as {
          status?: GenerationTaskStatus;
        };
        if (response.ok && data.status && !cancelled) {
          setTask({ id: id!, status: data.status });
        }
      } catch {
        // 保留本地任务 ID；网络恢复后仍可从生成页继续查询。
      }
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return task;
}

function taskCopy(status: GenerationTaskStatus) {
  if (status === "succeeded") {
    return { label: "任务已完成", detail: "点击查看生成结果", color: "bg-emerald-400" };
  }
  if (status === "failed") {
    return { label: "任务需要处理", detail: "点击查看错误并重新执行", color: "bg-rose-400" };
  }
  return { label: "1 个任务恢复中", detail: "任务正在后台运行", color: "bg-rose-400" };
}

export function ActiveTaskNav() {
  const task = useActiveTask();

  if (!task) {
    return (
      <span className="mt-1 flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-slate-500" aria-disabled="true">
        <span className="flex items-center gap-3"><Archive size={17} />任务历史</span>
        <span className="text-[10px]">即将推出</span>
      </span>
    );
  }

  const copy = taskCopy(task.status);
  return (
    <Link
      href="/generating"
      className="mt-1 flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white"
    >
      <span className="flex items-center gap-3">
        <span className="relative">
          <Archive size={17} />
          <span className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ${copy.color} ${task.status === "running" || task.status === "queued" ? "animate-pulse" : ""}`} />
        </span>
        任务历史
      </span>
      <span className="text-[10px] text-rose-300">{copy.label}</span>
    </Link>
  );
}

export function ActiveTaskRecoveryBanner() {
  const task = useActiveTask();
  if (!task) return null;
  const copy = taskCopy(task.status);

  return (
    <Link
      href="/generating"
      className="mb-6 flex items-center gap-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-4 text-sm transition hover:border-indigo-300 hover:bg-indigo-100/70"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-primary shadow-sm">
        {task.status === "running" || task.status === "queued"
          ? <LoaderCircle className="animate-spin" size={19} />
          : <Archive size={19} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{copy.label}</span>
        <span className="mt-1 block text-xs text-muted">{copy.detail}</span>
      </span>
      <ArrowRight className="shrink-0 text-primary" size={17} />
    </Link>
  );
}
