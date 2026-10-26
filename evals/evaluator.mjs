function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function stringifyContent(value) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value ?? "", null, 2);
}

function includesTerm(text, term) {
  return text.toLowerCase().includes(String(term).toLowerCase());
}

function statusSnapshot(result) {
  const review = normalize(result?.review_result);
  const risk = normalize(result?.risk_level);
  const human = normalize(result?.human_review_req);
  const blocked = review === "blocked" || risk === "high" || human === "yes" || human === "true";
  const delivered = review === "approved" && risk === "low" && (human === "no" || human === "false");
  return { review, risk, human, blocked, delivered };
}

export function evaluateCase(testCase, task) {
  const result = task?.result ?? {};
  const content = stringifyContent(result.final_content);
  const requiredHits = testCase.requiredTerms.filter((term) => includesTerm(content, term));
  const forbiddenHits = testCase.forbiddenTerms.filter((term) => includesTerm(content, term));
  const requiredCoverage = testCase.requiredTerms.length
    ? requiredHits.length / testCase.requiredTerms.length
    : 1;
  const status = statusSnapshot(result);
  const taskCompleted = task?.status === "succeeded" && content.trim().length > 2;
  const decisionCorrect = testCase.expectedAction === "block" ? status.blocked : status.delivered;

  const contentUsability = !taskCompleted ? 1
    : requiredCoverage === 1 ? 5
    : requiredCoverage >= 0.67 ? 4
    : requiredCoverage >= 0.34 ? 3
    : requiredCoverage > 0 ? 2 : 1;
  const brandConsistency = forbiddenHits.length === 0 ? 5
    : forbiddenHits.length === 1 ? 3 : 1;
  const factReliability = forbiddenHits.length === 0 ? 5
    : forbiddenHits.length === 1 ? 2 : 1;
  const riskHandling = decisionCorrect && forbiddenHits.length === 0 ? 5
    : decisionCorrect ? 4
    : status.blocked && testCase.expectedAction === "deliver" ? 2 : 1;
  const scores = { contentUsability, brandConsistency, factReliability, riskHandling };
  const averageScore = Object.values(scores).reduce((sum, value) => sum + value, 0) / 4;
  const revision = normalize(result?.revision_result);
  const autoRevisionSuccess = revision === "revised" ? (status.delivered && forbiddenHits.length === 0 ? 1 : 0) : null;
  const secondaryRisk = revision === "revised" ? (forbiddenHits.length ? 1 : 0) : null;
  const badcase = averageScore < 3 || forbiddenHits.length > 0 || !decisionCorrect || !taskCompleted;

  return {
    caseId: testCase.id,
    category: testCase.category,
    riskPressure: testCase.riskPressure,
    expectedAction: testCase.expectedAction,
    actual: { taskStatus: task?.status, review: status.review, risk: status.risk, humanReview: status.human, revision },
    checks: { requiredCoverage, requiredHits, missingRequired: testCase.requiredTerms.filter((term) => !requiredHits.includes(term)), forbiddenHits, decisionCorrect: decisionCorrect ? 1 : 0, taskCompleted: taskCompleted ? 1 : 0, autoRevisionSuccess, secondaryRisk },
    scores,
    averageScore,
    badcase,
    content,
    logs: task?.logs ?? [],
    error: task?.error ?? null,
  };
}

export function summarizeEvaluations(items) {
  const completed = items.filter((item) => item.checks.taskCompleted === 1);
  const highRisk = items.filter((item) => item.riskPressure === "high");
  const normal = items.filter((item) => item.riskPressure === "low");
  const revised = items.filter((item) => item.checks.autoRevisionSuccess !== null);
  const avg = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  return {
    sampleSize: items.length,
    completed: completed.length,
    completionRate: items.length ? completed.length / items.length : 0,
    averageScore: avg(items.map((item) => item.averageScore)),
    highRiskDecisionAccuracy: avg(highRisk.map((item) => item.checks.decisionCorrect)),
    normalFalseBlockRate: avg(normal.map((item) => item.actual.humanReview === "yes" || item.actual.review === "blocked" ? 1 : 0)),
    autoRevisionSuccessRate: avg(revised.map((item) => item.checks.autoRevisionSuccess)),
    secondaryRiskRate: avg(revised.map((item) => item.checks.secondaryRisk)),
    badcaseCount: items.filter((item) => item.badcase).length,
  };
}
