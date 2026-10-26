"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Info } from "lucide-react";
import { FormField, SelectField } from "./form-field";
import { OutputTypeSelector } from "./output-type-selector";
import { BrandAssetsUpload } from "./brand-assets-upload";
import { taskStorage } from "@/lib/storage";
import { LONG_TEXT_LIMITS } from "@/lib/input-limits";
import type { GenerateRequest, OutputType } from "@/types/brandflow";

function readRequest(form: HTMLFormElement, outputType: OutputType, brandAssets: GenerateRequest["brand_assets"]): GenerateRequest {
  const data = new FormData(form);
  const get = (key: string) => String(data.get(key) ?? "").trim();
  const confirmedAssets = brandAssets?.filter((asset) => asset.confirmed && asset.description.trim()) ?? [];
  const assetSummary = confirmedAssets.length
    ? `\n\n已人工确认的品牌视觉资产：\n${confirmedAssets.map((asset) => `- [${asset.kind}] ${asset.name}：${asset.description}`).join("\n")}`
    : "";
  return {
    brand_name: get("brand_name"),
    industry: get("industry"),
    brand_material: `${get("brand_material")}${assetSummary}`,
    campaign_name: get("campaign_name"),
    marketing_goal: get("marketing_goal"),
    core_product: get("core_product"),
    platform: get("platform"),
    output_type: outputType,
    ...(outputType === "social" ? { content_count: Number(get("content_count")) } : {
      video_duration: get("video_duration"),
      video_format: get("video_format"),
    }),
    selected_dir: get("selected_dir"),
    required_info: get("required_info"),
    prohibited_info: get("prohibited_info"),
    additional_req: get("additional_req"),
    brand_assets: confirmedAssets,
  };
}

function Section({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="panel p-5 sm:p-6" aria-labelledby={`section-${number}`}>
      <div className="mb-6 flex gap-3 border-b border-line pb-5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-indigo-50 text-xs font-bold text-primary">{number}</span>
        <div>
          <h2 id={`section-${number}`} className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function TaskForm() {
  const router = useRouter();
  const [outputType, setOutputType] = useState<OutputType>("social");
  const [brandAssets, setBrandAssets] = useState<GenerateRequest["brand_assets"]>([]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    taskStorage.saveRequest(readRequest(form, outputType, brandAssets));
    router.push("/generating");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Section number="01" title="品牌资料" description="提供经过确认的品牌与产品事实，帮助内容保持准确一致。">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField name="brand_name" label="品牌名称" placeholder="例如：澄野咖啡" required />
          <FormField name="industry" label="所属行业" placeholder="例如：精品咖啡与零售" required />
          <div className="sm:col-span-2">
            <FormField name="brand_material" label="品牌资料" placeholder="粘贴品牌定位、语气、目标人群、品牌禁忌等资料" help="建议包含品牌简介、核心价值、常用表达和视觉调性。" multiline rows={6} required maxLength={LONG_TEXT_LIMITS.brand_material.max} warningLength={LONG_TEXT_LIMITS.brand_material.warning} />
          </div>
        </div>
        <BrandAssetsUpload onChange={setBrandAssets} />
      </Section>

      <Section number="02" title="营销任务" description="描述本次活动的目标、产品与投放场景。">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField name="campaign_name" label="活动名称" placeholder="例如：夏日冷萃上新" required />
          <SelectField name="platform" label="发布平台" required>
            <option value="小红书">小红书</option><option value="微信公众号">微信公众号</option>
            <option value="抖音">抖音</option><option value="视频号">视频号</option>
            <option value="微博">微博</option><option value="其他">其他</option>
          </SelectField>
          <div className="sm:col-span-2"><FormField name="marketing_goal" label="营销目标" placeholder="例如：提升新品认知，引导用户到店试饮" multiline rows={3} required /></div>
          <div className="sm:col-span-2"><FormField name="core_product" label="核心产品及已确认信息" placeholder="产品名称、成分、售价、上市时间、可验证卖点等" help="只填写已确认事实；不确定的信息不要作为产品卖点。" multiline rows={5} required maxLength={LONG_TEXT_LIMITS.core_product.max} warningLength={LONG_TEXT_LIMITS.core_product.warning} /></div>
        </div>
      </Section>

      <Section number="03" title="生成设置" description="选择交付类型与内容规格。">
        <OutputTypeSelector value={outputType} onChange={setOutputType} />
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {outputType === "social" ? (
            <FormField name="content_count" label="生成数量" type="number" min={1} max={10} defaultValue={3} help="单次可生成 1–10 条文案。" required />
          ) : (
            <>
              <SelectField name="video_duration" label="视频时长" required><option value="15秒">15 秒</option><option value="30秒">30 秒</option><option value="60秒">60 秒</option><option value="90秒">90 秒</option></SelectField>
              <SelectField name="video_format" label="视频画幅" required><option value="9:16 竖屏">9:16 竖屏</option><option value="16:9 横屏">16:9 横屏</option><option value="1:1 方形">1:1 方形</option></SelectField>
            </>
          )}
          <div className="sm:col-span-2"><FormField name="selected_dir" label="指定内容方向" placeholder="例如：从通勤场景切入，突出清爽口感（选填）" multiline rows={3} /></div>
        </div>
      </Section>

      <Section number="04" title="约束与补充" description="明确必须出现和禁止出现的内容，降低审核成本。">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField name="required_info" label="必须包含的信息" placeholder="例如：上市日期、门店范围、官方活动话题（选填）" multiline rows={4} maxLength={LONG_TEXT_LIMITS.required_info.max} warningLength={LONG_TEXT_LIMITS.required_info.warning} />
          <FormField name="prohibited_info" label="禁止出现的信息" placeholder="例如：绝对化用语、未经证实的功效描述（选填）" multiline rows={4} maxLength={LONG_TEXT_LIMITS.prohibited_info.max} warningLength={LONG_TEXT_LIMITS.prohibited_info.warning} />
          <div className="sm:col-span-2"><FormField name="additional_req" label="补充要求" placeholder="其他语气、格式或交付要求（选填）" multiline rows={3} maxLength={LONG_TEXT_LIMITS.additional_req.max} warningLength={LONG_TEXT_LIMITS.additional_req.warning} /></div>
        </div>
      </Section>

      <div className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex max-w-xl gap-2 text-xs leading-5 text-muted"><Info className="mt-0.5 shrink-0" size={15} />提交后任务将在服务端后台运行。即使关闭页面，重新打开 BrandFlow 也可以恢复任务进度。</p>
        <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">
          开始生成 <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}
