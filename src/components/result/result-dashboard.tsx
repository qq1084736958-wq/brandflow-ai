"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Clipboard, ExternalLink, FileCheck2, LoaderCircle, Plus, Save, ShieldCheck } from "lucide-react";
import { taskStorage } from "@/lib/storage";
import {
  asRecord,
  extractItems,
  extractRevisionChanges,
  isCopyBlocked,
  normalizeGenerateResult,
  parsePossibleJson,
  parseReviewReport,
  replaceContentItem,
  toText,
} from "@/lib/result-utils";
import { ContentRenderer } from "./content-renderer";
import { ReviewReportView } from "./review-report";
import { ReviewSummary } from "./review-summary";
import { RevisionDiff, revisionChangeKey } from "./revision-diff";
import { VisualAssetsPanel } from "./visual-assets-panel";
import type { GenerateResult, StoredResult } from "@/types/brandflow";

const socialKeys = ["contents", "content", "posts", "items", "social_content"];
const videoKeys = ["storyboard", "shots", "scenes", "script", "分镜"];

function hasDisplayContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "" && value.trim() !== "—";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

export function ResultDashboard() {
  const [stored, setStored] = useState<StoredResult | null>(null);
  const [currentResult, setCurrentResult] = useState<GenerateResult | null>(null);
  const [workingContent, setWorkingContent] = useState<unknown>(null);
  const workingRef = useRef<unknown>(null);
  const [loaded, setLoaded] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [confirmedChangeKeys, setConfirmedChangeKeys] = useState<Set<string>>(new Set());
  const [confirmationError, setConfirmationError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const result = taskStorage.getResult();
      setStored(result);
      if (result) {
        const normalizedResult = normalizeGenerateResult(result.result);
        setCurrentResult(normalizedResult);
        const generated = parsePossibleJson(normalizedResult.final_content);
        const draft = taskStorage.getDraft();
        const content = draft?.campaignName === result.campaignName
          && draft.outputType === result.outputType
          && hasDisplayContent(draft.content)
          ? draft.content
          : generated;
        workingRef.current = content;
        setWorkingContent(content);
        taskStorage.saveResult({ ...result, result: normalizedResult });
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!loaded) return <div className="panel h-64 animate-pulse bg-white" aria-label="正在读取结果" />;
  if (!stored || !currentResult) return (
    <div className="panel p-8 text-center">
      <FileCheck2 className="mx-auto text-slate-400" size={32} /><h2 className="mt-4 text-lg font-semibold">暂未找到生成结果</h2>
      <p className="mt-2 text-sm text-muted">当前浏览器会话中没有可展示的内容，请重新创建任务。</p>
      <Link href="/" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} />创建任务</Link>
    </div>
  );

  const { outputType, campaignName } = stored;
  const request = taskStorage.getRequest();
  const report = parseReviewReport(currentResult.review_report);
  const changes = extractRevisionChanges(currentResult, report);
  const allChangesConfirmed = changes.length === 0
    || changes.every((change, index) => confirmedChangeKeys.has(revisionChangeKey(change, index)));
  const confirmedChangeCount = changes.filter(
    (change, index) => confirmedChangeKeys.has(revisionChangeKey(change, index)),
  ).length;
  const globallyBlocked = isCopyBlocked(currentResult.review_result, currentResult.risk_level);
  const blockedIds = new Set<string>();
  let hasUnlocatedHighRisk = false;
  report?.issues?.forEach((issue) => {
    if (String(issue.severity).toLowerCase() !== "high") return;
    const match = issue.location?.match(/(content_\d+|scene_\d+)/i);
    if (match) blockedIds.add(match[1]);
    else hasUnlocatedHighRisk = true;
  });

  function updateContent(value: unknown) {
    workingRef.current = value;
    setWorkingContent(value);
    setDisclaimerAccepted(false);
    setConfirmedChangeKeys(new Set());
    setConfirmationError("");
    setSaved(false);
  }

  function persistResult(result: GenerateResult, content = workingRef.current) {
    const next = { ...result, final_content: content };
    setCurrentResult(next);
    taskStorage.saveResult({ ...stored!, result: next });
  }

  function saveDraft() {
    if (!currentResult) return;
    taskStorage.saveDraft({ campaignName, outputType, content: workingRef.current, savedAt: new Date().toISOString() });
    persistResult(currentResult);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  async function copyContent() {
    if (!allChangesConfirmed) {
      setConfirmationError("还有风险项未人工确认，请逐条勾选“已核对本次修改”后再试。");
      return;
    }
    setConfirmationError("");
    await navigator.clipboard.writeText(toText(workingContent));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function updateChangeConfirmation(key: string, checked: boolean) {
    setConfirmedChangeKeys((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
    setConfirmationError("");
  }

  async function runItemAction(action: "regenerate" | "revise", contentId: string, item: unknown, instruction?: string) {
    if (!request || !currentResult) return;
    const resultSnapshot = currentResult;
    setBusyId(contentId);
    setActionError("");
    try {
      const response = await fetch("/api/item-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, contentId, item, instruction, request }),
      });
      const data = await response.json() as GenerateResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "单篇处理失败");
      const generated = parsePossibleJson(data.final_content);
      const keys = outputType === "social" ? socialKeys : videoKeys;
      const replacement = extractItems(generated, keys)[0];
      const replacementRecord = asRecord(replacement);
      const normalized = replacementRecord
        ? outputType === "social"
          ? { ...replacementRecord, content_id: contentId }
          : { ...replacementRecord, scene_no: Number(contentId.replace(/\D/g, "")) || replacementRecord.scene_no }
        : replacement;
      const nextContent = replaceContentItem(workingRef.current, keys, contentId, normalized, outputType);
      updateContent(nextContent);
      const nextResult = { ...resultSnapshot, ...data, final_content: nextContent };
      persistResult(nextResult, nextContent);
      saveDraftValue(nextContent);
      setConfirmedChangeKeys(new Set());
      setDisclaimerAccepted(false);
      setConfirmationError("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "单篇处理失败");
    } finally {
      setBusyId("");
    }
  }

  function saveDraftValue(content: unknown) {
    taskStorage.saveDraft({ campaignName, outputType, content, savedAt: new Date().toISOString() });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  async function reReview() {
    if (!request || !currentResult) return;
    const resultSnapshot = currentResult;
    setReviewing(true);
    setActionError("");
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, content: workingRef.current }),
      });
      const data = await response.json() as Record<string, unknown> & { error?: string };
      if (!response.ok) throw new Error(data.error || "重新审核失败");
      const reviewedReport = parseReviewReport(data.review_report ?? data);
      const nextResult: GenerateResult = {
        ...resultSnapshot,
        review_result: data.review_result ?? reviewedReport?.review_result ?? resultSnapshot.review_result,
        revision_result: data.revision_result ?? "no_change",
        risk_level: data.risk_level ?? reviewedReport?.risk_level ?? resultSnapshot.risk_level,
        review_report: data.review_report ?? data,
        human_review_req: data.human_review_req ?? reviewedReport?.human_review_req ?? resultSnapshot.human_review_req,
        final_content: workingRef.current,
      };
      persistResult(nextResult);
      setDisclaimerAccepted(false);
      setConfirmedChangeKeys(new Set());
      setConfirmationError("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "重新审核失败");
    } finally {
      setReviewing(false);
    }
  }

  const visualPrompt = `${campaignName}\n${toText(workingContent).slice(0, 1600)}`;

  return (
    <div className="space-y-5">
      <div className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">生成完成</p><h2 className="mt-2 text-xl font-semibold">{campaignName}</h2><p className="mt-1 text-sm text-muted">{outputType === "social" ? "社交媒体文案" : "短视频脚本"} · 支持逐篇编辑与重新审核</p></div>
          <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"><Plus size={16} />新建任务</Link>
        </div>
        <div className="mt-5 border-t border-line pt-5"><ReviewSummary review={currentResult.review_result} revision={currentResult.revision_result} risk={currentResult.risk_level} humanReview={currentResult.human_review_req} report={report} /></div>
      </div>

      {actionError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{actionError}</div>}

      <section className="panel p-5 sm:p-6" aria-labelledby="final-content-title">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 id="final-content-title" className="text-base font-semibold">最终内容</h2><p className="mt-1 text-sm text-muted">每篇内容可以独立编辑、保存、复制、重新生成或局部修正</p></div>
          <button type="button" onClick={saveDraft} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold hover:bg-slate-50"><Save size={15} />{saved ? "草稿已保存" : "保存全部草稿"}</button>
        </div>
        <ContentRenderer
          type={outputType}
          value={workingContent}
          onChange={updateContent}
          onSaveDraft={saveDraft}
          onAction={runItemAction}
          busyId={busyId}
          copyBlocked={hasUnlocatedHighRisk || !allChangesConfirmed}
          copyBlockedReason={!allChangesConfirmed ? "还有风险项未人工确认，请先逐条核对修改结果。" : undefined}
          blockedIds={blockedIds}
        />
      </section>

      <section className="panel p-5 sm:p-6" aria-labelledby="revision-diff-title">
        <h2 id="revision-diff-title" className="text-base font-semibold">修改前后对比</h2>
        <p className="mt-1 text-sm text-muted">区分可自动安全修正、需人工确认和必须人工处理，并逐条确认修改结果。</p>
        {changes.length > 0 && (
          <div className={`mt-4 rounded-lg border px-4 py-3 text-sm font-medium ${allChangesConfirmed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
            已核对 {confirmedChangeCount}/{changes.length} 项修改。全部核对后才可复制最终内容。
          </div>
        )}
        <RevisionDiff
          changes={changes}
          confirmedKeys={confirmedChangeKeys}
          onConfirmChange={updateChangeConfirmation}
        />
      </section>

      <section className="panel p-5 sm:p-6" aria-labelledby="review-report-title">
        <h2 id="review-report-title" className="text-base font-semibold">审核报告</h2>
        <p className="mt-1 text-sm text-muted">品牌一致性、事实与平台风险检查</p>
        <ReviewReportView value={currentResult.review_report} />
      </section>

      <VisualAssetsPanel prompt={visualPrompt} />

      <section className="panel border-amber-200 p-5 sm:p-6" aria-labelledby="human-review-title">
        <div className="flex gap-3"><FileCheck2 className="mt-0.5 shrink-0 text-amber-700" size={20} /><div><h2 id="human-review-title" className="text-base font-semibold">发布前人工审核</h2><p className="mt-2 text-sm leading-6 text-muted">AI 生成内容仅作为创作初稿，发布前请人工确认产品事实、品牌表达和平台规范。</p></div></div>
        {globallyBlocked && <div className="mt-4 flex gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"><ShieldCheck className="shrink-0" size={18} />存在高风险红线，已阻断“复制全部内容”。请修正问题并重新审核。</div>}
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-slate-50 p-4 text-sm font-medium">
          <input type="checkbox" checked={disclaimerAccepted} onChange={(event) => setDisclaimerAccepted(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-primary" />
          <span>
            我已阅读并理解上述风险项与发布责任
            <span className="mt-1 block text-xs font-normal text-muted">此项仅为责任说明，不替代上方逐条修改确认。</span>
          </span>
        </label>
        {confirmationError && (
          <div role="alert" aria-live="assertive" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {confirmationError}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={reviewing} onClick={() => void reReview()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary bg-white px-5 text-sm font-semibold text-primary hover:bg-indigo-50 disabled:opacity-50">{reviewing ? <LoaderCircle className="animate-spin" size={16} /> : <ExternalLink size={16} />}重新审核编辑版本</button>
          <button type="button" disabled={globallyBlocked} onClick={() => void copyContent()} title={globallyBlocked ? "高风险内容必须修正并重新审核后才能复制" : undefined} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:bg-slate-300">
            {copied ? <><Check size={16} />已复制</> : <><Clipboard size={16} />复制全部最终内容</>}
          </button>
        </div>
      </section>
    </div>
  );
}
