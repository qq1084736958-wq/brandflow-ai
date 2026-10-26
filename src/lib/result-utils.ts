import type { GenerateResult } from "@/types/brandflow";
import type { DimensionScoreItem, RemainingRisk, ReviewIssue, ReviewReport, RevisionChange } from "@/types/review";

export function parsePossibleJson(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 6 && typeof current === "string"; depth += 1) {
    try {
      current = JSON.parse(current);
    } catch {
      break;
    }
  }
  return current;
}

export function normalizeGenerateResult(value: unknown): GenerateResult {
  let current = parsePossibleJson(value);

  for (let depth = 0; depth < 6; depth += 1) {
    const record = asRecord(current);
    if (!record || record.output === undefined) break;

    const next = parsePossibleJson(record.output);
    if (next === current) break;
    current = next;
  }

  const record = asRecord(current) ?? {};
  return {
    ...record,
    final_content: record.final_content ?? "",
    review_result: record.review_result ?? "",
    revision_result: record.revision_result ?? "",
    risk_level: record.risk_level ?? "",
    review_report: record.review_report ?? "",
    human_review_req: record.human_review_req ?? "",
  };
}

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  return typeof record[key] === "string" ? record[key] : undefined;
}

export function parseReviewReport(value: unknown): ReviewReport | null {
  const parsed = parsePossibleJson(value);
  const record = asRecord(parsed);
  if (!record) return null;

  const issues = Array.isArray(record.issues) ? record.issues.flatMap((item): ReviewIssue[] => {
    const issue = asRecord(item);
    if (!issue) return [];
    return [{
      risk_type: optionalString(issue, "risk_type"),
      severity: optionalString(issue, "severity"),
      location: optionalString(issue, "location"),
      original_text: optionalString(issue, "original_text"),
      problem: optionalString(issue, "problem"),
      basis: optionalString(issue, "basis"),
      suggestion: optionalString(issue, "suggestion"),
    }];
  }) : undefined;
  const changes = parseRecordArray<RevisionChange>(parsePossibleJson(record.changes), (change) => ({
    change_id: optionalString(change, "change_id"),
    location: optionalString(change, "location"),
    original_text: optionalString(change, "original_text"),
    revised_text: optionalString(change, "revised_text"),
    risk_type: optionalString(change, "risk_type"),
    severity: optionalString(change, "severity"),
    reason: optionalString(change, "reason"),
    correction_method: optionalString(change, "correction_method"),
  }));
  const remainingRisks = parseRecordArray<RemainingRisk>(record.remaining_risks, (risk) => ({
    risk_id: optionalString(risk, "risk_id"),
    location: optionalString(risk, "location"),
    risk_type: optionalString(risk, "risk_type"),
    severity: optionalString(risk, "severity"),
    description: optionalString(risk, "description"),
    human_action: optionalString(risk, "human_action"),
  }));
  const passedChecks = Array.isArray(record.passed_checks)
    ? record.passed_checks.filter((item): item is string => typeof item === "string")
    : undefined;
  let dimensionScores: ReviewReport["dimension_scores"];
  const dimensions = record.dimension_scores;
  if (Array.isArray(dimensions)) {
    dimensionScores = dimensions.flatMap((item): DimensionScoreItem[] => {
      const dimension = asRecord(item);
      const score = finiteNumber(dimension?.score);
      const name = dimension?.dimension;
      return typeof name === "string" && score !== null ? [{ dimension: name, score }] : [];
    });
  } else {
    const dimensionRecord = asRecord(dimensions);
    if (dimensionRecord) {
      dimensionScores = Object.fromEntries(Object.entries(dimensionRecord).flatMap(([key, score]) => {
        const number = finiteNumber(score);
        return number === null ? [] : [[key, number]];
      }));
    }
  }

  return {
    ...record,
    summary: typeof record.summary === "string" ? record.summary : undefined,
    overall_score: finiteNumber(record.overall_score) ?? undefined,
    issue_count: finiteNumber(record.issue_count) ?? undefined,
    dimension_scores: dimensionScores,
    issues,
    passed_checks: passedChecks,
    revision_brief: typeof record.revision_brief === "string" ? record.revision_brief : undefined,
    changes,
    remaining_risks: remainingRisks,
  };
}

function parseRecordArray<T>(value: unknown, map: (record: Record<string, unknown>) => T): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.flatMap((item) => {
    const record = asRecord(item);
    return record ? [map(record)] : [];
  });
}

const reviewResultLabels: Record<string, string> = {
  approved: "已通过",
  needs_revision: "发现问题",
  blocked: "暂停发布",
};

const revisionResultLabels: Record<string, string> = {
  revised: "已自动修改",
  no_change: "无需修改",
  blocked_need_human: "等待人工处理",
};

const riskLevelLabels: Record<string, string> = { low: "低风险", medium: "中风险", high: "高风险" };
const humanReviewLabels: Record<string, string> = { yes: "需要人工审核", no: "建议人工确认" };

function mapStatus(value: unknown, labels: Record<string, string>) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return labels[normalized] ?? toText(value);
}

export const mapReviewResult = (value: unknown) => mapStatus(value, reviewResultLabels);
export const mapRevisionResult = (value: unknown) => mapStatus(value, revisionResultLabels);
export const mapRiskLevel = (value: unknown) => mapStatus(value, riskLevelLabels);
export const mapHumanReview = (value: unknown) => mapStatus(value, humanReviewLabels);

export function reviewOutcome(review: unknown, revision: unknown, report?: ReviewReport | null): string | null {
  if (String(review).toLowerCase() === "needs_revision" && String(revision).toLowerCase() === "revised") {
    const count = report?.issue_count ?? report?.issues?.length;
    const riskTypes = Array.from(new Set(report?.issues?.map((issue) => issue.risk_type).filter(Boolean) ?? []));
    const countText = typeof count === "number" ? `${count} 处问题` : "问题";
    const typeText = riskTypes.length ? `（${riskTypes.map(mapRiskType).join("、")}）` : "";
    return `审核发现 ${countText}${typeText}，系统已尝试自动修正。请确认修改是否准确。`;
  }
  return null;
}

export function mapRiskType(value: unknown): string {
  const normalized = String(value ?? "").toLowerCase();
  const labels: Record<string, string> = {
    redline_compliance: "红线合规",
    factual_accuracy: "事实准确性",
    brand_consistency: "品牌一致性",
    tone_context: "语气与语境",
    platform_compliance: "平台规范",
  };
  return labels[normalized] ?? String(value || "其他问题").replaceAll("_", " ");
}

export function isCopyBlocked(review: unknown, risk: unknown): boolean {
  return String(review ?? "").toLowerCase() === "blocked" || String(risk ?? "").toLowerCase() === "high";
}

export function contentItemId(item: unknown, index: number, type: "social" | "video"): string {
  const record = asRecord(item);
  const value = record?.content_id ?? record?.scene_id ?? record?.scene_no;
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return `scene_${String(value).padStart(2, "0")}`;
  return type === "social" ? `content_${String(index + 1).padStart(2, "0")}` : `scene_${String(index + 1).padStart(2, "0")}`;
}

export function replaceContentItem(value: unknown, keys: string[], contentId: string, replacement: unknown, type: "social" | "video"): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => contentItemId(item, index, type) === contentId ? replacement : item);
  }
  const record = asRecord(value);
  if (!record) return value;
  for (const key of keys) {
    if (Array.isArray(record[key])) {
      return {
        ...record,
        [key]: (record[key] as unknown[]).map((item, index) => contentItemId(item, index, type) === contentId ? replacement : item),
      };
    }
  }
  return replacement;
}

export function extractRevisionChanges(result: Record<string, unknown>, report: ReviewReport | null): RevisionChange[] {
  const candidates = [
    result.changes,
    result.revision_changes,
    asRecord(result.revision_data)?.changes,
    report?.changes,
    asRecord(report?.revision)?.changes,
  ];
  for (const candidate of candidates) {
    const parsed = parseRecordArray<RevisionChange>(parsePossibleJson(candidate), (change) => ({
      change_id: optionalString(change, "change_id"),
      location: optionalString(change, "location"),
      original_text: optionalString(change, "original_text"),
      revised_text: optionalString(change, "revised_text"),
      risk_type: optionalString(change, "risk_type"),
      severity: optionalString(change, "severity"),
      reason: optionalString(change, "reason"),
      correction_method: optionalString(change, "correction_method"),
    }));
    if (parsed?.length) return parsed;
  }
  if (String(result.revision_result).toLowerCase() === "revised" && report?.issues?.length) {
    return report.issues.flatMap((issue, index): RevisionChange[] => issue.original_text ? [{
      change_id: `review_issue_${index + 1}`,
      location: issue.location,
      original_text: issue.original_text,
      revised_text: "",
      risk_type: issue.risk_type,
      severity: issue.severity,
      reason: `${issue.problem || "审核发现风险"}。工作流未透传精确修订文本，请核对最终内容上下文。`,
      correction_method: issue.severity === "high" ? "blocked" : "human_confirm",
    }] : []);
  }
  return [];
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function toText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "是" : "否";
  return JSON.stringify(value, null, 2);
}

export function getField(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) if (record[key] !== undefined) return record[key];
  return undefined;
}

export function extractItems(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [value];
  for (const key of keys) if (Array.isArray(record[key])) return record[key] as unknown[];
  return [record];
}

export function normalizeTags(value: unknown): string[] {
  const parsed = parsePossibleJson(value);
  const values = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "string"
      ? parsed.split(/[,，\s]+/)
      : [];
  return values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.startsWith("#") ? item : `#${item}`);
}
