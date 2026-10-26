import { AlertCircle, Check, ChevronDown, FileText, PencilLine } from "lucide-react";
import { parsePossibleJson, parseReviewReport, toText } from "@/lib/result-utils";
import type { DimensionScoreItem, ReviewIssue, ReviewReport } from "@/types/review";

const dimensionLabels: Record<string, string> = {
  brand_consistency: "品牌一致性",
  brand_alignment: "品牌表达",
  product_accuracy: "产品事实准确性",
  factual_accuracy: "事实准确性",
  platform_compliance: "平台规范",
  compliance: "合规性",
  content_quality: "内容质量",
  tone_of_voice: "品牌语气",
  risk_control: "风险控制",
};

function dimensionItems(scores: ReviewReport["dimension_scores"]): DimensionScoreItem[] {
  if (!scores) return [];
  return Array.isArray(scores) ? scores : Object.entries(scores).map(([dimension, score]) => ({ dimension, score }));
}

function dimensionLabel(value: string) {
  return dimensionLabels[value.toLowerCase()] ?? value.replaceAll("_", " ");
}

function severityMeta(value?: string) {
  const severity = String(value ?? "unknown").toLowerCase();
  if (["critical", "severe"].includes(severity)) return { label: "严重", style: "border-rose-200 bg-rose-50 text-rose-700" };
  if (severity === "high") return { label: "高风险", style: "border-rose-200 bg-rose-50 text-rose-700" };
  if (["medium", "moderate", "warning"].includes(severity)) return { label: "中风险", style: "border-amber-200 bg-amber-50 text-amber-800" };
  if (severity === "low") return { label: "低风险", style: "border-sky-200 bg-sky-50 text-sky-700" };
  return { label: value || "未分级", style: "border-slate-200 bg-slate-50 text-slate-700" };
}

function DimensionScores({ scores }: { scores: ReviewReport["dimension_scores"] }) {
  const items = dimensionItems(scores);
  if (!items.length) return null;
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold">维度评分</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {items.map(({ dimension, score }) => {
          const safeScore = Math.max(0, Math.min(100, score));
          return <div key={dimension} className="rounded-lg border border-line p-4"><div className="flex justify-between gap-4 text-sm"><span className="font-medium">{dimensionLabel(dimension)}</span><span className="font-semibold text-primary">{safeScore} 分</span></div><progress className="mt-3 h-2 w-full overflow-hidden rounded-full accent-primary" max={100} value={safeScore} aria-label={`${dimensionLabel(dimension)} ${safeScore}分`} /></div>;
        })}
      </div>
    </div>
  );
}

function IssueCard({ issue, index }: { issue: ReviewIssue; index: number }) {
  const severity = severityMeta(issue.severity);
  const details = [["位置", issue.location], ["原文", issue.original_text], ["问题", issue.problem], ["依据", issue.basis], ["修改建议", issue.suggestion]];
  return (
    <article className="rounded-lg border border-line bg-white p-5">
      <div className="flex flex-wrap items-center gap-3"><span className="text-sm font-semibold">问题 {index + 1}</span><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${severity.style}`}>{severity.label}</span></div>
      <dl className="mt-4 grid gap-3">
        {details.map(([label, value]) => <div key={label} className="grid gap-1 sm:grid-cols-[88px_1fr]"><dt className="text-xs font-medium text-muted">{label}</dt><dd className={`whitespace-pre-wrap text-sm leading-6 ${label === "修改建议" ? "font-medium text-ink" : "text-slate-700"}`}>{value || "未提供"}</dd></div>)}
      </dl>
    </article>
  );
}

function StructuredReport({ report }: { report: ReviewReport }) {
  const issueCount = report.issue_count ?? report.issues?.length ?? 0;
  return (
    <div className="mt-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
        <div className="rounded-lg border border-line bg-slate-50 p-4"><p className="text-xs font-medium text-muted">审核总结</p><p className="mt-2 text-sm leading-6 text-ink">{report.summary || "暂无审核总结"}</p></div>
        <div className="rounded-lg border border-line p-4 sm:min-w-28"><p className="text-xs text-muted">综合评分</p><p className="mt-1 text-xl font-semibold">{report.overall_score ?? "—"}<span className="ml-1 text-xs font-normal text-muted">分</span></p></div>
        <div className="rounded-lg border border-line p-4 sm:min-w-28"><p className="text-xs text-muted">问题数量</p><p className="mt-1 text-xl font-semibold">{issueCount}<span className="ml-1 text-xs font-normal text-muted">项</span></p></div>
      </div>

      <DimensionScores scores={report.dimension_scores} />

      {!!report.issues?.length && <div className="mt-6"><h3 className="flex items-center gap-2 text-sm font-semibold"><AlertCircle size={16} className="text-amber-600" />发现的问题</h3><div className="mt-3 space-y-3">{report.issues.map((issue, index) => <IssueCard key={index} issue={issue} index={index} />)}</div></div>}

      {!!report.passed_checks?.length && <div className="mt-6"><h3 className="text-sm font-semibold">通过检查</h3><ul className="mt-3 grid gap-2 sm:grid-cols-2">{report.passed_checks.map((check, index) => <li key={`${check}-${index}`} className="flex gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900"><Check className="mt-0.5 shrink-0" size={15} />{check}</li>)}</ul></div>}

      {report.revision_brief && <div className="mt-6 rounded-lg border border-indigo-100 bg-indigo-50/60 p-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><PencilLine size={16} className="text-primary" />修改摘要</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.revision_brief}</p></div>}
    </div>
  );
}

export function ReviewReportView({ value }: { value: unknown }) {
  const parsed = parseReviewReport(value);
  const raw = parsePossibleJson(value);
  return (
    <>
      {parsed ? <StructuredReport report={parsed} /> : <div className="mt-5 rounded-lg border border-line bg-slate-50 p-4"><p className="flex items-center gap-2 text-sm font-semibold"><FileText size={16} />审核报告</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{toText(value)}</p></div>}
      {parsed && <details className="group mt-6 border-t border-line pt-4"><summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-muted hover:text-ink">查看原始审核数据<ChevronDown className="transition group-open:rotate-180" size={16} /></summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-200">{toText(raw)}</pre></details>}
    </>
  );
}
