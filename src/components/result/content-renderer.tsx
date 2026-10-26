"use client";

import { useState } from "react";
import { Check, Clapperboard, Clipboard, Eye, Hash, Megaphone, Pencil, RefreshCw, Save, Sparkles, X } from "lucide-react";
import { asRecord, contentItemId, extractItems, getField, normalizeTags, replaceContentItem, toText } from "@/lib/result-utils";
import type { OutputType } from "@/types/brandflow";

type ItemAction = (action: "regenerate" | "revise", contentId: string, item: unknown, instruction?: string) => Promise<void>;

interface ContentRendererProps {
  type: OutputType;
  value: unknown;
  onChange: (value: unknown) => void;
  onSaveDraft: () => void;
  onAction: ItemAction;
  busyId?: string;
  copyBlocked?: boolean;
  copyBlockedReason?: string;
  blockedIds?: Set<string>;
}

const socialKeys = ["contents", "content", "posts", "items", "social_content"];
const videoKeys = ["storyboard", "shots", "scenes", "script", "分镜"];

function PlainContent({ value }: { value: unknown }) {
  return <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-ink">{toText(value)}</pre>;
}

function ItemToolbar({
  contentId, item, blocked, blockedReason, busy, onEdit, onAction,
}: {
  contentId: string; item: unknown; blocked: boolean; blockedReason?: string; busy: boolean; onEdit: () => void; onAction: ItemAction;
}) {
  const [copied, setCopied] = useState(false);
  const [showRevise, setShowRevise] = useState(false);
  const [instruction, setInstruction] = useState("");

  async function copy() {
    await navigator.clipboard.writeText(toText(item));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="border-t border-line bg-slate-50/70 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"><Pencil size={14} />编辑</button>
        <button type="button" disabled={blocked} onClick={() => void copy()} title={blocked ? blockedReason || "该内容存在高风险红线，完成修正并重新审核后才能复制" : undefined} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45">{copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? "已复制" : "单独复制"}</button>
        <button type="button" disabled={busy} onClick={() => void onAction("regenerate", contentId, item)} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={busy ? "animate-spin" : ""} size={14} />重新生成</button>
        <button type="button" disabled={busy} onClick={() => setShowRevise((value) => !value)} className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-primary hover:bg-indigo-100 disabled:opacity-50"><Sparkles size={14} />局部修正</button>
      </div>
      {blocked && <p className="mt-2 text-xs font-medium text-rose-700">{blockedReason || "检测到高风险红线，此篇内容已阻断复制。"}</p>}
      {showRevise && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="例如：保留标题，只调整第二段的功效描述" className="min-h-10 flex-1 rounded-md border border-line bg-white px-3 text-sm" />
          <button type="button" disabled={busy || !instruction.trim()} onClick={() => void onAction("revise", contentId, item, instruction)} className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white disabled:bg-slate-300">提交修正</button>
        </div>
      )}
    </div>
  );
}

function SocialCard({
  item, index, value, onChange, onSaveDraft, onAction, busy, blocked, blockedReason,
}: {
  item: unknown; index: number; value: unknown; onChange: (value: unknown) => void; onSaveDraft: () => void; onAction: ItemAction; busy: boolean; blocked: boolean; blockedReason?: string;
}) {
  const record = asRecord(item);
  const contentId = contentItemId(item, index, "social");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  if (!record) return <div className="rounded-lg border border-line p-5"><PlainContent value={item} /></div>;

  const title = getField(record, "title", "标题");
  const body = getField(record, "body", "content", "copy", "正文");
  const cta = getField(record, "cta", "CTA", "行动号召");
  const tags = getField(record, "tags", "hashtags", "标签");
  const visual = getField(record, "visual_suggest", "visual_suggestion", "visual", "视觉建议");
  const fields = {
    title: draft.title ?? toText(title),
    body: draft.body ?? toText(body),
    cta: draft.cta ?? toText(cta),
    hashtags: draft.hashtags ?? normalizeTags(tags).join(" "),
    visual_suggest: draft.visual_suggest ?? (visual ? toText(visual) : ""),
  };

  function startEdit() {
    setDraft(fields);
    setEditing(true);
  }

  function save() {
    const replacement = { ...record, content_id: contentId, ...fields, hashtags: normalizeTags(fields.hashtags) };
    onChange(replaceContentItem(value, socialKeys, contentId, replacement, "social"));
    setEditing(false);
    window.setTimeout(onSaveDraft, 0);
  }

  return (
    <article className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3"><span className="grid h-7 min-w-7 place-items-center rounded-md bg-indigo-50 px-1.5 text-xs font-bold text-primary">{contentId}</span><h3 className="font-semibold">{toText(title)}</h3></div>
        {editing ? (
          <div className="space-y-4">
            <EditField label="标题" value={fields.title} onChange={(value) => setDraft({ ...fields, title: value })} />
            <EditField label="正文" value={fields.body} rows={7} onChange={(value) => setDraft({ ...fields, body: value })} />
            <EditField label="CTA" value={fields.cta} onChange={(value) => setDraft({ ...fields, cta: value })} />
            <EditField label="标签" value={fields.hashtags} onChange={(value) => setDraft({ ...fields, hashtags: value })} />
            <EditField label="视觉建议" value={fields.visual_suggest} rows={3} onChange={(value) => setDraft({ ...fields, visual_suggest: value })} />
            <div className="flex gap-2"><button type="button" onClick={save} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white"><Save size={14} />保存草稿</button><button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-1.5 rounded-md border border-line px-4 py-2 text-xs font-semibold"><X size={14} />取消</button></div>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{toText(body)}</p>
            <dl className="mt-5 grid gap-3 border-t border-line pt-4 text-sm">
              <InfoRow icon={Megaphone} label="CTA" value={toText(cta)} />
              <div className="flex gap-3"><Hash className="mt-0.5 shrink-0 text-primary" size={16} /><div><dt className="font-medium">标签</dt><dd className="mt-2 flex flex-wrap gap-2">{normalizeTags(tags).length ? normalizeTags(tags).map((tag, tagIndex) => <span key={`${tag}-${tagIndex}`} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-primary">{tag}</span>) : <span className="text-muted">暂无标签</span>}</dd></div></div>
              <InfoRow icon={Eye} label="视觉建议" value={visual ? toText(visual) : "暂无视觉建议"} />
            </dl>
          </>
        )}
      </div>
      {!editing && <ItemToolbar contentId={contentId} item={item} blocked={blocked} blockedReason={blockedReason} busy={busy} onEdit={startEdit} onAction={onAction} />}
    </article>
  );
}

function VideoCard({
  item, index, value, onChange, onSaveDraft, onAction, busy, blocked, blockedReason,
}: {
  item: unknown; index: number; value: unknown; onChange: (value: unknown) => void; onSaveDraft: () => void; onAction: ItemAction; busy: boolean; blocked: boolean; blockedReason?: string;
}) {
  const record = asRecord(item);
  const contentId = contentItemId(item, index, "video");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  if (!record) return <div className="rounded-lg border border-line p-5"><PlainContent value={item} /></div>;
  const safeRecord = record;
  const definitions = [
    ["time_range", "时间", getField(record, "time_range", "time", "timestamp", "duration", "时间")],
    ["visual", "画面", getField(record, "visual", "scene", "画面")],
    ["action", "动作", getField(record, "action", "动作")],
    ["voiceover", "旁白", getField(record, "voiceover", "narration", "旁白")],
    ["subtitle", "字幕", getField(record, "subtitle", "caption", "字幕")],
    ["transition", "转场", getField(record, "transition", "转场")],
  ] as const;
  const fields = Object.fromEntries(definitions.map(([key, , field]) => [key, draft[key] ?? toText(field)]));

  function startEdit() {
    setDraft(fields);
    setEditing(true);
  }

  function save() {
    const replacement = { ...safeRecord, ...fields, scene_no: safeRecord.scene_no ?? index + 1 };
    onChange(replaceContentItem(value, videoKeys, contentId, replacement, "video"));
    setEditing(false);
    window.setTimeout(onSaveDraft, 0);
  }

  return (
    <article className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="sm:grid sm:grid-cols-[120px_1fr]">
        <div className="flex items-center gap-2 border-b border-line bg-slate-50 px-4 py-3 text-sm font-semibold text-primary sm:block sm:border-b-0 sm:border-r sm:py-5"><Clapperboard size={17} /><span className="sm:mt-2 sm:block">{contentId}</span><span className="text-xs font-normal text-muted sm:mt-1 sm:block">{fields.time_range}</span></div>
        <div className="p-5">
          {editing ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {definitions.map(([key, label]) => <EditField key={key} label={label} value={fields[key]} rows={key === "visual" || key === "voiceover" ? 3 : 2} onChange={(value) => setDraft({ ...fields, [key]: value })} />)}
              <div className="flex gap-2 sm:col-span-2"><button type="button" onClick={save} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white"><Save size={14} />保存草稿</button><button type="button" onClick={() => setEditing(false)} className="inline-flex items-center gap-1.5 rounded-md border border-line px-4 py-2 text-xs font-semibold"><X size={14} />取消</button></div>
            </div>
          ) : (
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{definitions.slice(1).map(([key, label]) => <div key={key}><dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt><dd className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-ink">{fields[key]}</dd></div>)}</dl>
          )}
        </div>
      </div>
      {!editing && <ItemToolbar contentId={contentId} item={item} blocked={blocked} blockedReason={blockedReason} busy={busy} onEdit={startEdit} onAction={onAction} />}
    </article>
  );
}

function EditField({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <label className="block text-xs font-semibold text-muted">{label}<textarea value={value === "—" ? "" : value} onChange={(event) => onChange(event.target.value)} rows={rows} className="field-control resize-y font-normal text-ink" /></label>;
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: string }) {
  return <div className="flex gap-3"><Icon className="mt-0.5 shrink-0 text-primary" size={16} /><div><dt className="font-medium">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-muted">{value}</dd></div></div>;
}

export function ContentRenderer({ type, value, onChange, onSaveDraft, onAction, busyId, copyBlocked = false, copyBlockedReason, blockedIds = new Set() }: ContentRendererProps) {
  const keys = type === "social" ? socialKeys : videoKeys;
  const items = extractItems(value, keys);
  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const id = contentItemId(item, index, type);
        const itemHasHighRisk = blockedIds.has(id);
        const props = {
          item,
          index,
          value,
          onChange,
          onSaveDraft,
          onAction,
          busy: busyId === id,
          blocked: copyBlocked || itemHasHighRisk,
          blockedReason: itemHasHighRisk
            ? "该内容存在高风险红线，完成修正并重新审核后才能复制。"
            : copyBlockedReason,
        };
        return type === "social" ? <SocialCard key={id} {...props} /> : <VideoCard key={id} {...props} />;
      })}
    </div>
  );
}
