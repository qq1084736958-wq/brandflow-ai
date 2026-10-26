import { AppShell } from "@/components/app-shell/app-shell";
import { GenerationProgress } from "@/components/generation/generation-progress";

export default function GeneratingPage() {
  return (
    <AppShell activeStep={2}>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <p className="text-sm font-semibold text-primary">AI 生成</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          正在构建品牌内容
        </h1>
        <p className="mb-8 mt-3 text-sm leading-6 text-muted">
          任务会在服务端后台运行。即使关闭页面，重新打开本站也可以恢复本轮任务。
        </p>
        <GenerationProgress />
      </div>
    </AppShell>
  );
}
