export interface ReviewIssue {
  risk_type?: string;
  severity?: string;
  location?: string;
  original_text?: string;
  problem?: string;
  basis?: string;
  suggestion?: string;
}

export interface RevisionChange {
  change_id?: string;
  location?: string;
  original_text?: string;
  revised_text?: string;
  risk_type?: string;
  severity?: string;
  reason?: string;
  correction_method?: "auto_safe" | "human_confirm" | "blocked" | string;
}

export interface RemainingRisk {
  risk_id?: string;
  location?: string;
  risk_type?: string;
  severity?: string;
  description?: string;
  human_action?: string;
}

export interface DimensionScoreItem {
  dimension: string;
  score: number;
}

export type DimensionScores = Record<string, number> | DimensionScoreItem[];

export interface ReviewReport {
  summary?: string;
  overall_score?: number;
  issue_count?: number;
  dimension_scores?: DimensionScores;
  issues?: ReviewIssue[];
  passed_checks?: string[];
  revision_brief?: string;
  changes?: RevisionChange[];
  remaining_risks?: RemainingRisk[];
  [key: string]: unknown;
}
