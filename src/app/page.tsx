import { AppShell } from "@/components/app-shell/app-shell";
import { TaskForm } from "@/components/task-form/task-form";
import { ActiveTaskRecoveryBanner } from "@/components/task-recovery/task-recovery";

export default function CreateTaskPage() {
  return (
    <AppShell activeStep={1}>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
        <div className="mb-8">
          <p className="text-sm font-semibold text-primary">新建内容任务</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">让每一条内容都符合品牌标准</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">输入品牌资料与营销任务，BrandFlow AI 将完成内容策略、生成、一致性审核与风险修正。</p>
        </div>
        <ActiveTaskRecoveryBanner />
        <TaskForm />
      </div>
    </AppShell>
  );
}
