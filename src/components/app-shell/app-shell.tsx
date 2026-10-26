import Link from "next/link";
import { BookOpen, ChevronRight, FilePlus2, Sparkles, Users } from "lucide-react";
import { ActiveTaskNav } from "@/components/task-recovery/task-recovery";

const steps = [
  { label: "创建任务", description: "填写品牌与营销需求" },
  { label: "AI 生成", description: "策略、内容与风险修正" },
  { label: "人工审核", description: "确认后复制最终内容" },
];

export function AppShell({ children, activeStep = 1 }: { children: React.ReactNode; activeStep?: number }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="border-b border-line bg-[#15182b] text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5 lg:h-20">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary" aria-hidden="true">
            <Sparkles size={18} />
          </span>
          <div>
            <Link href="/" className="text-base font-semibold tracking-tight">BrandFlow AI</Link>
            <p className="text-xs text-slate-400">品牌内容工作台</p>
          </div>
        </div>

        <nav aria-label="主要导航" className="hidden px-3 pt-5 lg:block">
          <p className="px-3 text-xs font-medium uppercase tracking-wider text-slate-500">工作空间</p>
          <Link href="/" className="mt-2 flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-medium">
            <FilePlus2 size={17} /> 创建内容
          </Link>
          <ActiveTaskNav />
          {[{ icon: BookOpen, label: "品牌库" }, { icon: Users, label: "团队协作" }].map(({ icon: Icon, label }) => (
            <span key={label} className="mt-1 flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-slate-500" aria-disabled="true">
              <span className="flex items-center gap-3"><Icon size={17} />{label}</span>
              <span className="text-[10px]">即将推出</span>
            </span>
          ))}
        </nav>

        <div className="hidden px-6 pt-10 lg:block">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">当前流程</p>
          <ol className="mt-5 space-y-6">
            {steps.map((step, index) => {
              const number = index + 1;
              const active = number === activeStep;
              const complete = number < activeStep;
              return (
                <li key={step.label} className="flex gap-3">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${active ? "bg-primary text-white" : complete ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-slate-400"}`}>
                    {complete ? "✓" : number}
                  </span>
                  <div>
                    <p className={active ? "text-sm font-medium text-white" : "text-sm text-slate-400"}>{step.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </aside>

      <main className="min-w-0">
        <header className="flex h-14 items-center justify-between border-b border-line bg-white px-4 sm:px-6 lg:h-16 lg:px-10">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span>内容工作台</span><ChevronRight size={14} /><span className="font-medium text-ink">{steps[activeStep - 1]?.label}</span>
          </div>
          <span className="rounded-full border border-line bg-slate-50 px-3 py-1 text-xs font-medium text-muted">MVP</span>
        </header>
        {children}
      </main>
    </div>
  );
}
