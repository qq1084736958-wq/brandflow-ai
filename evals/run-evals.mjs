import fs from "node:fs/promises";
import path from "node:path";
import { cases } from "./cases.mjs";
import { evaluateCase, summarizeEvaluations } from "./evaluator.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.length ? rest.join("=") : true];
}));
const baseUrl = String(args["base-url"] || process.env.BRANDFLOW_EVAL_BASE_URL || "http://127.0.0.1:3010").replace(/\/$/, "");
const timeoutMs = Number(args["timeout-ms"] || 360000);
const concurrency = Math.max(1, Math.min(Number(args.concurrency || 2), 4));
const selectedIds = String(args.cases || "").split(",").filter(Boolean);
const selectedCases = selectedIds.length ? cases.filter((item) => selectedIds.includes(item.id)) : cases;
const outputDir = path.resolve("evals", "results", new Date().toISOString().replace(/[:.]/g, "-") + "-brandflow");

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${body.error || response.statusText}`);
  return body;
}

async function waitForTask(taskId) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const task = await requestJson(`${baseUrl}/api/tasks/${taskId}`);
      if (task.status === "succeeded" || task.status === "failed") return task;
    } catch (error) {
      if (!/^400 |^404 /.test(error instanceof Error ? error.message : "")) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return { id: taskId, status: "failed", error: `超过${timeoutMs}ms仍未完成`, logs: [] };
}

async function runCase(testCase) {
  const startedAt = Date.now();
  try {
    const created = await requestJson(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(testCase.request),
    });
    const task = await waitForTask(created.task_id);
    const evaluation = evaluateCase(testCase, task);
    return { ...evaluation, taskId: created.task_id, latencySeconds: Math.round((Date.now() - startedAt) / 100) / 10 };
  } catch (error) {
    const task = { status: "failed", error: error instanceof Error ? error.message : String(error), logs: [] };
    return { ...evaluateCase(testCase, task), taskId: null, latencySeconds: Math.round((Date.now() - startedAt) / 100) / 10 };
  }
}

async function worker(queue, results) {
  while (queue.length) {
    const testCase = queue.shift();
    console.log(`[${results.length + 1}/${selectedCases.length}] 开始 ${testCase.id} ${testCase.category}`);
    const result = await runCase(testCase);
    results.push(result);
    console.log(`  ${testCase.id}: ${result.actual.taskStatus}, score=${result.averageScore.toFixed(2)}, decision=${result.checks.decisionCorrect}, ${result.latencySeconds}s`);
  }
}

function csvCell(value) {
  const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function renderMarkdown(summary, results) {
  const pct = (value) => `${(value * 100).toFixed(1)}%`;
  const rows = results.map((item) => `| ${item.caseId} | ${item.category} | ${item.actual.taskStatus} | ${item.averageScore.toFixed(2)} | ${item.checks.decisionCorrect} | ${item.checks.forbiddenHits.join("、") || "-"} | ${item.badcase ? "是" : "否"} |`).join("\n");
  return `# BrandFlow AI 自动评测报告\n\n> 这是离线规则评测，不代表线上用户效果或法律/平台合规保证。\n\n## 汇总结论\n\n- 样本数：${summary.sampleSize}\n- 完成率：${pct(summary.completionRate)}\n- 平均分：${summary.averageScore.toFixed(2)} / 5\n- 高风险决策正确率：${pct(summary.highRiskDecisionAccuracy)}\n- 正常样本误拦截率：${pct(summary.normalFalseBlockRate)}\n- 自动修正成功率：${pct(summary.autoRevisionSuccessRate)}\n- 修改后二次风险率：${pct(summary.secondaryRiskRate)}\n- Badcase：${summary.badcaseCount}\n\n## 逐条结果\n\n| Case | 类别 | 状态 | 平均分 | 决策正确 | 命中禁用表达 | Badcase |\n|---|---|---:|---:|---:|---|---|\n${rows}\n\n## 口径说明\n\n自动评分检查必含词覆盖、禁用表达、审核状态、风险等级、转人工和任务完成。内容审美、平台语感与真实品牌偏好仍需人工抽样复核。\n`;
}

try {
  await requestJson(`${baseUrl}/api/tasks?limit=1`);
} catch (error) {
  console.error(`BrandFlow服务不可用：${baseUrl}\n请先运行 npm run dev，再执行 npm run eval:brandflow。\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

await fs.mkdir(outputDir, { recursive: true });
const queue = [...selectedCases];
const results = [];
await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker(queue, results)));
results.sort((a, b) => a.caseId.localeCompare(b.caseId));
const summary = summarizeEvaluations(results);
await fs.writeFile(path.join(outputDir, "results.json"), JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, summary, results }, null, 2), "utf8");
const csvHeaders = ["case_id","category","task_status","review_result","risk_level","human_review","revision_result","latency_seconds","required_coverage","forbidden_hits","decision_correct","task_completed","content_usability","brand_consistency","fact_reliability","risk_handling","average_score","badcase","error"];
const csvRows = results.map((item) => [item.caseId,item.category,item.actual.taskStatus,item.actual.review,item.actual.risk,item.actual.humanReview,item.actual.revision,item.latencySeconds,item.checks.requiredCoverage,item.checks.forbiddenHits,item.checks.decisionCorrect,item.checks.taskCompleted,item.scores.contentUsability,item.scores.brandConsistency,item.scores.factReliability,item.scores.riskHandling,item.averageScore,item.badcase,item.error].map(csvCell).join(","));
await fs.writeFile(path.join(outputDir, "results.csv"), [csvHeaders.join(","), ...csvRows].join("\n"), "utf8");
await fs.writeFile(path.join(outputDir, "report.md"), renderMarkdown(summary, results), "utf8");
console.log(`\n评测完成：${outputDir}`);
console.log(JSON.stringify(summary, null, 2));
