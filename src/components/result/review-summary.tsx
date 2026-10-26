import { AlertTriangle, CheckCircle2, CircleHelp, RefreshCw, UserCheck } from "lucide-react";
import { mapHumanReview, mapReviewResult, mapRevisionResult, mapRiskLevel, reviewOutcome } from "@/lib/result-utils";
import type { ReviewReport } from "@/types/review";

function riskStyle(level: unknown) {
  const text = String(level ?? "未知").toLowerCase();
  if (/高|high|严重|critical/.test(text)) return "border-rose-200 bg-rose-50 text-rose-700";
  if (/中|medium|moderate/.test(text)) return "border-amber-200 bg-amber-50 text-amber-800";
  if (/低|low|安全|pass/.test(text)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function ReviewSummary({ review, revision, risk, humanReview, report }: { review: unknown; revision: unknown; risk: unknown; humanReview: unknown; report?: ReviewReport | null }) {
  const outcome = reviewOutcome(review, revision, report);
  return (
    <>
      {outcome && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{outcome}</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Summary icon={CheckCircle2} label="审核结论" value={mapReviewResult(review)} />
        <Summary icon={RefreshCw} label="修改状态" value={mapRevisionResult(revision)} />
        <div className="rounded-lg border border-line bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-medium text-muted"><AlertTriangle size={15} />风险等级
            <span className="group relative">
              <button type="button" aria-label="查看风险等级说明" className="rounded-full text-slate-400 hover:text-primary"><CircleHelp size={14} /></button>
              <span role="tooltip" className="pointer-events-none absolute right-0 top-6 z-10 hidden w-64 rounded-lg border border-line bg-slate-950 p-3 text-xs font-normal leading-5 text-white shadow-lg group-hover:block group-focus-within:block">高风险：红线违规，必须阻断复制并人工处理。中风险：事实可能不准确，系统修改后仍需确认。低风险：语气或语境建议，不等于没有问题。</span>
            </span>
          </p>
          <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${riskStyle(risk)}`}>{mapRiskLevel(risk)}</span>
        </div>
        <Summary icon={UserCheck} label="人工审核" value={mapHumanReview(humanReview)} />
      </div>
    </>
  );
}

function Summary({ icon: Icon, label, value }: { icon: typeof CheckCircle2; label: string; value: string }) {
  return <div className="rounded-lg border border-line bg-white p-4"><p className="flex items-center gap-2 text-xs font-medium text-muted"><Icon size={15} />{label}</p><p className="mt-3 line-clamp-3 text-sm font-semibold leading-5 text-ink">{value}</p></div>;
}
