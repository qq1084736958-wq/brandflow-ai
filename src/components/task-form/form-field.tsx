"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

type Props = {
  name: string;
  label: string;
  required?: boolean;
  help?: string;
  placeholder?: string;
  type?: "text" | "number";
  min?: number;
  max?: number;
  multiline?: boolean;
  rows?: number;
  defaultValue?: string | number;
  maxLength?: number;
  warningLength?: number;
};

export function FormField({
  name,
  label,
  required,
  help,
  multiline,
  rows = 4,
  defaultValue,
  maxLength,
  warningLength,
  ...inputProps
}: Props) {
  const id = `field-${name}`;
  const helpId = help ? `${id}-help` : undefined;
  const warningId = multiline && warningLength ? `${id}-warning` : undefined;
  const describedBy = [helpId, warningId].filter(Boolean).join(" ") || undefined;
  const [characterCount, setCharacterCount] = useState(
    typeof defaultValue === "string" ? defaultValue.length : 0,
  );
  const showWarning = Boolean(
    multiline
      && warningLength
      && characterCount > warningLength,
  );
  const shared = {
    id,
    name,
    required,
    defaultValue,
    maxLength,
    "aria-describedby": describedBy,
    className: "field-control",
  };

  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}{required && <span className="ml-1 text-rose-600" aria-label="必填">*</span>}
      </label>
      {multiline ? (
        <textarea
          {...shared}
          {...inputProps}
          rows={rows}
          onChange={(event) => setCharacterCount(event.target.value.length)}
        />
      ) : (
        <input {...shared} {...inputProps} />
      )}
      {(help || (multiline && maxLength)) && (
        <div className="mt-1.5 flex items-start justify-between gap-3">
          {help ? <p id={helpId} className="text-xs leading-5 text-muted">{help}</p> : <span />}
          {multiline && maxLength && (
            <span className={`shrink-0 text-xs font-medium tabular-nums ${showWarning ? "text-amber-700" : "text-muted"}`}>
              {characterCount}/{maxLength}
            </span>
          )}
        </div>
      )}
      {showWarning && (
        <p id={warningId} role="status" className="mt-2 flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-900">
          <AlertTriangle className="mt-0.5 shrink-0" size={14} />
          内容较长，可能导致 AI 理解偏差，建议精简或分批次输入。
        </p>
      )}
    </div>
  );
}

export function SelectField({ name, label, children, required }: { name: string; label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="field-label" htmlFor={`field-${name}`}>
        {label}{required && <span className="ml-1 text-rose-600" aria-label="必填">*</span>}
      </label>
      <select id={`field-${name}`} name={name} required={required} defaultValue="" className="field-control">
        <option value="" disabled>请选择</option>
        {children}
      </select>
    </div>
  );
}
