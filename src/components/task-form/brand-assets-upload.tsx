"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileImage, Film, Trash2, Upload } from "lucide-react";
import type { BrandAsset } from "@/types/brandflow";

type AssetView = BrandAsset & { previewUrl: string };

function mediaType(file: File): BrandAsset["mediaType"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

async function imageSize(file: File): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith("image/")) return {};
  const bitmap = await createImageBitmap(file);
  const result = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return result;
}

export function BrandAssetsUpload({ onChange }: { onChange: (assets: BrandAsset[]) => void }) {
  const [assets, setAssets] = useState<AssetView[]>([]);
  const assetsRef = useRef(assets);

  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  useEffect(() => () => {
    assetsRef.current.forEach((asset) => URL.revokeObjectURL(asset.previewUrl));
  }, []);

  function commit(next: AssetView[]) {
    setAssets(next);
    onChange(next.map((asset) => ({
      id: asset.id,
      name: asset.name,
      kind: asset.kind,
      mediaType: asset.mediaType,
      mimeType: asset.mimeType,
      size: asset.size,
      width: asset.width,
      height: asset.height,
      duration: asset.duration,
      description: asset.description,
      confirmed: asset.confirmed,
    })));
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const accepted = Array.from(files).filter((file) =>
      file.type.startsWith("image/") || file.type.startsWith("video/") || file.type === "application/pdf",
    );
    const next = await Promise.all(accepted.slice(0, Math.max(0, 8 - assets.length)).map(async (file) => {
      const dimensions = await imageSize(file).catch(() => ({}));
      return {
        id: crypto.randomUUID(),
        name: file.name,
        kind: file.name.toLowerCase().includes("logo") ? "logo" as const : "product" as const,
        mediaType: mediaType(file),
        mimeType: file.type,
        size: file.size,
        ...dimensions,
        description: "",
        confirmed: false,
        previewUrl: URL.createObjectURL(file),
      };
    }));
    commit([...assets, ...next]);
  }

  function update(id: string, patch: Partial<AssetView>) {
    commit(assets.map((asset) => asset.id === id ? { ...asset, ...patch } : asset));
  }

  function remove(id: string) {
    const target = assets.find((asset) => asset.id === id);
    if (target) URL.revokeObjectURL(target.previewUrl);
    commit(assets.filter((asset) => asset.id !== id));
  }

  return (
    <div className="mt-5 border-t border-line pt-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">品牌视觉资产</h3>
          <p className="mt-1 text-xs leading-5 text-muted">上传产品图、Logo、门店照片、短视频或 PDF，并确认 AI 可使用的事实描述。</p>
        </div>
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-3.5 text-sm font-semibold hover:bg-slate-50">
          <Upload size={16} />上传资产
          <input className="sr-only" type="file" multiple accept="image/*,video/*,.pdf" onChange={(event) => void addFiles(event.target.files)} />
        </label>
      </div>

      {assets.length > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {assets.map((asset) => (
            <article key={asset.id} className="overflow-hidden rounded-lg border border-line bg-slate-50">
              <div className="grid grid-cols-[112px_1fr] gap-4 p-4">
                <div className="grid aspect-square place-items-center overflow-hidden rounded-lg border border-line bg-white">
                  {asset.mediaType === "image"
                    // Blob URLs are local previews and cannot use Next Image optimization.
                    ? <img src={asset.previewUrl} alt={asset.description || asset.name} className="h-full w-full object-cover" />
                    : asset.mediaType === "video"
                      ? <Film className="text-slate-400" size={28} />
                      : <FileImage className="text-slate-400" size={28} />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="truncate text-sm font-semibold">{asset.name}</p><p className="mt-1 text-xs text-muted">{(asset.size / 1024 / 1024).toFixed(1)} MB{asset.width ? ` · ${asset.width}×${asset.height}` : ""}</p></div>
                    <button type="button" onClick={() => remove(asset.id)} aria-label={`删除 ${asset.name}`} className="rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={15} /></button>
                  </div>
                  <select value={asset.kind} onChange={(event) => update(asset.id, { kind: event.target.value as BrandAsset["kind"] })} className="mt-3 w-full rounded-md border border-line bg-white px-2.5 py-2 text-xs">
                    <option value="logo">品牌 Logo</option><option value="product">产品实拍</option><option value="store">门店/空间</option><option value="reference">风格参考</option>
                  </select>
                </div>
              </div>
              <div className="border-t border-line bg-white p-4">
                <label className="text-xs font-medium">已确认的视觉事实描述
                  <textarea value={asset.description} onChange={(event) => update(asset.id, { description: event.target.value, confirmed: false })} placeholder="例如：瓶身为磨砂透明材质，Logo 为深绿色，不包含金色装饰。" rows={2} className="field-control resize-y" />
                </label>
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs font-medium">
                  <input type="checkbox" checked={asset.confirmed} disabled={!asset.description.trim()} onChange={(event) => update(asset.id, { confirmed: event.target.checked })} className="mt-0.5 accent-primary" />
                  <span className="flex gap-1.5">{asset.confirmed && <CheckCircle2 className="text-emerald-600" size={14} />}我确认这段描述与上传资产一致，可供生成和审核使用</span>
                </label>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
