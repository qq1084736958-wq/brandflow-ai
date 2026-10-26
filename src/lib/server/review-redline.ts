function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch { /* fall through */ }
  }
  return {};
}

function redlineTerms(prohibitedInfo: string): string[] {
  const configured = prohibitedInfo
    .split(/[、,，;；。\n]+/)
    .map((item) => item.replace(/^(禁止|不得|不允许|避免)(出现|使用)?/, "").trim())
    .filter((item) => item.length >= 2 && item.length <= 24);
  return Array.from(new Set([
    "全网第一", "最好", "最优", "顶级", "百分之百", "100%",
    "保证提神", "治疗", "治愈", "疗效", "减肥", "绝对无害",
    ...configured,
  ]));
}

export function applyRedlineGate(
  result: Record<string, unknown>,
  contentText: string,
  prohibitedInfo: string,
): Record<string, unknown> {
  const matched = redlineTerms(prohibitedInfo).filter((term) => contentText.toLowerCase().includes(term.toLowerCase()));
  if (!matched.length) return result;

  const report = asRecord(result.review_report ?? result);
  const existingIssues = Array.isArray(report.issues) ? report.issues : [];
  const contentId = contentText.match(/content_\d+|scene_\d+/i)?.[0] || "final_content";
  const redlineIssues = matched.map((term, index) => ({
    issue_id: `server_redline_${index + 1}`,
    severity: "high",
    risk_type: "redline_compliance",
    location: `${contentId}.body`,
    original_text: term,
    problem: `命中发布红线或用户明确禁止表达：“${term}”`,
    basis: "服务端确定性红线规则与用户提交的禁止信息",
    suggestion: "必须人工删除或改写，并重新审核后才能复制发布。",
  }));
  const issues = [...existingIssues, ...redlineIssues];
  const nextReport = {
    ...report,
    summary: `检测到 ${matched.length} 处高风险红线，已强制阻断复制与发布。`,
    issue_count: issues.length,
    issues,
    review_result: "blocked",
    risk_level: "high",
    human_review_req: "yes",
    revision_brief: "红线内容不进行自动删除，必须由人工修改并重新审核。",
  };
  return {
    ...result,
    review_result: "blocked",
    revision_result: "blocked_need_human",
    risk_level: "high",
    human_review_req: "yes",
    review_report: nextReport,
  };
}
