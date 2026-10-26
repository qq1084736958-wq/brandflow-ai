import { Clapperboard, MessageSquareText } from "lucide-react";
import type { OutputType } from "@/types/brandflow";

const options = [
  { value: "social" as const, label: "社交媒体文案", description: "标题、正文、CTA、标签与视觉建议", icon: MessageSquareText },
  { value: "video" as const, label: "短视频脚本", description: "按时间拆解画面、动作、旁白与转场", icon: Clapperboard },
];

export function OutputTypeSelector({ value, onChange }: { value: OutputType; onChange: (value: OutputType) => void }) {
  return (
    <fieldset>
      <legend className="field-label">内容类型<span className="ml-1 text-rose-600" aria-label="必填">*</span></legend>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {options.map(({ value: optionValue, label, description, icon: Icon }) => {
          const selected = value === optionValue;
          return (
            <label key={optionValue} className={`relative flex cursor-pointer gap-3 rounded-lg border p-4 transition ${selected ? "border-primary bg-indigo-50/60 ring-1 ring-primary" : "border-line bg-white hover:border-slate-300"}`}>
              <input className="sr-only" type="radio" name="output_type" value={optionValue} checked={selected} onChange={() => onChange(optionValue)} />
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${selected ? "bg-primary text-white" : "bg-slate-100 text-muted"}`}><Icon size={18} /></span>
              <span>
                <span className="block text-sm font-semibold text-ink">{label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted">{description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
