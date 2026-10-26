"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { ExternalLink, Image as ImageIcon, LoaderCircle, ShieldCheck } from "lucide-react";
import type { VisualAsset } from "@/types/brandflow";

export function VisualAssetsPanel({ prompt }: { prompt: string }) {
  const [assets, setAssets] = useState<VisualAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function requestAssets() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/visual-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, count: 4, require_license_metadata: true }),
      });
      const data = await response.json() as { assets?: VisualAsset[]; error?: string };
      if (!response.ok) throw new Error(data.error || "配图服务请求失败");
      setAssets(Array.isArray(data.assets) ? data.assets : []);
      if (!data.assets?.length) setMessage("配图服务没有返回可用素材。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "配图服务请求失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel p-5 sm:p-6" aria-labelledby="visual-assets-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 id="visual-assets-title" className="flex items-center gap-2 text-base font-semibold"><ImageIcon size={18} />配图与版权素材</h2><p className="mt-1 text-sm text-muted">仅展示包含明确来源与授权信息的素材；未配置服务时不会生成或伪造图片。</p></div>
        <button type="button" disabled={loading} onClick={() => void requestAssets()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">{loading && <LoaderCircle className="animate-spin" size={15} />}查找或生成配图</button>
      </div>
      {message && <p role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</p>}
      {/* Provider URLs are dynamic and intentionally bypass Next Image host allowlists. */}
      {assets.length > 0 && <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{assets.map((asset) => <article key={asset.id} className="overflow-hidden rounded-lg border border-line"><img src={asset.thumbnailUrl || asset.url} alt={asset.prompt || "品牌配图素材"} className="aspect-square w-full object-cover" /><div className="p-3"><p className="text-xs font-semibold">{asset.source}</p><p className="mt-1 flex gap-1.5 text-xs text-muted"><ShieldCheck size={13} />{asset.license}</p>{asset.attribution && <p className="mt-1 text-xs text-muted">{asset.attribution}</p>}<a href={asset.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">查看来源<ExternalLink size={12} /></a></div></article>)}</div>}
    </section>
  );
}
