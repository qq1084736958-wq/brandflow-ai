"use client";

import { AlertTriangle, Check, GitCompareArrows, ShieldAlert } from "lucide-react";
import { mapRiskType } from "@/lib/result-utils";
import type { RevisionChange } from "@/types/review";

function methodLabel(method?: string, severity?: string) {
  if (method === "blocked" || severity === "high") return { label: "必须人工处理", style: "bg-rose-50 text-rose-700 border-rose-200" };
  if (method === "human_confirm") return { label: "需人工确认", style: "bg-amber-50 text-amber-800 border-amber-200" };
  return { label: "可自动安全修正", style: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

function diffParts(before = "", after = "") {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (beforeEnd > start && afterEnd > start && before[beforeEnd - 1] === after[afterEnd - 1]) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }
  return {
    prefix: before.slice(0, start),
    removed: before.slice(start, beforeEnd),
    added: after.slice(start, afterEnd),
    suffix: before.slice(beforeEnd),
  };
}

export function revisionChangeKey(change: RevisionChange, index: number): string {
  return change.change_id || `${change.location || "change"}-${index}`;
}

interface RevisionDiffProps {
  changes: RevisionChange[];
  confirmedKeys: Set<string>;
  onConfirmChange: (key: string, checked: boolean) => void;
}

export function RevisionDiff({ changes, confirmedKeys, onConfirmChange }: RevisionDiffProps) {
  if (!changes.length) {
    return <div className="mt-4 rounded-lg border border-dashed border-line bg-slate-50 p-4 text-sm text-muted">当前返回结果没有提供逐条修改差异。重新发布主工作流并透传 `changes` 后，此处会自动显示原文与修改后文本。</div>;
  }

  return (
    <div className="mt-4 space-y-3">
      {changes.map((change, index) => {
        const method = methodLabel(change.correction_method, change.severity);
        const parts = diffParts(change.original_text, change.revised_text);
        const confirmationKey = revisionChangeKey(change, index);
        const checked = confirmedKeys.has(confirmationKey);
        return (
          <article key={confirmationKey} className="overflow-hidden rounded-lg border border-line bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-slate-50 px-4 py-3">
              <GitCompareArrows className="text-primary" size={16} />
              <span className="text-sm font-semibold">{change.location || `修改 ${index + 1}`}</span>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${method.style}`}>{method.label}</span>
              <span className="text-xs text-muted">{mapRiskType(change.risk_type)}</span>
            </div>
            <div className="grid gap-3 p-4 lg:grid-cols-2">
              <div className="rounded-md border border-rose-100 bg-rose-50/50 p-3"><p className="text-xs font-semibold text-rose-700">修改前</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{parts.prefix}<mark className="bg-rose-200 text-rose-950 line-through">{parts.removed}</mark>{parts.suffix}</p></div>
              <div className="rounded-md border border-emerald-100 bg-emerald-50/50 p-3"><p className="text-xs font-semibold text-emerald-700">修改后</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{parts.prefix}<mark className="bg-emerald-200 text-emerald-950">{parts.added}</mark>{parts.suffix}</p></div>
            </div>
            <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex gap-2 text-xs leading-5 text-muted">{change.severity === "high" ? <ShieldAlert className="mt-0.5 shrink-0 text-rose-600" size={14} /> : <AlertTriangle className="mt-0.5 shrink-0 text-amber-600" size={14} />}{change.reason || "请确认修改后语句完整、通顺且不再包含同义风险表达。"}</p>
              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => onConfirmChange(confirmationKey, event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-primary"
                />
                {checked && <Check className="text-emerald-600" size={14} />}
                已核对本次修改
              </label>
            </div>
          </article>
        );
      })}
    </div>
  );
}
