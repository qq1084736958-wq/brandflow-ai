import { AppShell } from "@/components/app-shell/app-shell";
import { ResultDashboard } from "@/components/result/result-dashboard";

export default function ResultPage() {
  return (
    <AppShell activeStep={3}>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <p className="text-sm font-semibold text-primary">审核结果</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">内容已生成，请完成最终确认</h1>
        <p className="mb-8 mt-3 text-sm leading-6 text-muted">查看 AI 审核结论、风险等级与最终内容，人工确认后即可复制。</p>
        <ResultDashboard />
      </div>
    </AppShell>
  );
}
