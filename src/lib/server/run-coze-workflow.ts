import { CozeStreamError, readCozeStream } from "./coze-stream";

const DEFAULT_TIMEOUT_MS = 300_000;

export class CozeRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function runCozeWorkflow(
  workflowId: string,
  parameters: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Record<string, unknown>> {
  const token = process.env.COZE_API_TOKEN;
  if (!token) throw new CozeRequestError("服务端尚未配置 Coze 凭据", "CONFIG_MISSING", 500);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const baseUrl = (process.env.COZE_API_BASE_URL || "https://api.coze.com").replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/v1/workflow/stream_run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_id: workflowId, parameters }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.status === 401 || response.status === 403) {
      throw new CozeRequestError("Coze 鉴权失败，请检查服务端凭据", "COZE_AUTH_FAILED", 502);
    }
    if (!response.ok) {
      throw new CozeRequestError(`Coze 工作流请求失败（${response.status}）`, "COZE_REQUEST_FAILED", 502);
    }
    if (!response.body) throw new CozeRequestError("Coze 工作流未返回响应流", "EMPTY_STREAM", 502);

    const parsed = await readCozeStream(response.body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new CozeRequestError("工作流结果格式不正确", "INVALID_RESULT", 502);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof CozeRequestError) throw error;
    if (error instanceof CozeStreamError) {
      throw new CozeRequestError(
        error.kind === "parse" ? "无法解析 Coze 工作流结果" : error.message,
        error.kind === "parse" ? "PARSE_FAILED" : "WORKFLOW_FAILED",
        502,
      );
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new CozeRequestError("Coze 工作流响应超时，请稍后重试", "TIMEOUT", 504);
    }
    throw new CozeRequestError("连接 Coze 工作流失败，请稍后重试", "UPSTREAM_UNAVAILABLE", 502);
  } finally {
    clearTimeout(timeout);
  }
}

export function unwrapWorkflowOutput(value: Record<string, unknown>): Record<string, unknown> {
  let current: unknown = value;

  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof current === "string") {
      try {
        current = JSON.parse(current);
        continue;
      } catch {
        break;
      }
    }

    if (!current || typeof current !== "object" || Array.isArray(current)) break;

    const record = current as Record<string, unknown>;
    if (record.output === undefined) return record;

    const previous = current;
    current = record.output;
    if (current === previous) break;
  }

  return current && typeof current === "object" && !Array.isArray(current)
    ? current as Record<string, unknown>
    : value;
}
