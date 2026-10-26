export class CozeStreamError extends Error {
  constructor(message: string, public readonly kind: "workflow" | "parse") { super(message); }
}

type SseEvent = { name: string; data: string };

function parseBlock(block: string): SseEvent | null {
  let name = "message";
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) name = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  return { name, data: data.join("\n") };
}

function eventPayload(event: SseEvent): Record<string, unknown> | null {
  try {
    const value = JSON.parse(event.data);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

function getEventName(event: SseEvent, payload: Record<string, unknown> | null): string {
  const payloadName = typeof payload?.event === "string" ? payload.event : "";
  return (payloadName || event.name).toLowerCase();
}

function getMessageContent(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  if (typeof payload.content === "string") return payload.content;
  const message = payload.message;
  if (message && typeof message === "object" && !Array.isArray(message)) {
    const content = (message as Record<string, unknown>).content;
    return typeof content === "string" ? content : null;
  }
  return null;
}

function getWorkflowError(payload: Record<string, unknown> | null): string {
  const nestedError = payload?.error;
  const errorRecord = nestedError && typeof nestedError === "object" && !Array.isArray(nestedError)
    ? nestedError as Record<string, unknown>
    : {};
  const values = { ...payload, ...errorRecord };
  const message = [values.message, values.error_message, values.msg]
    .find((value) => typeof value === "string" && value.trim()) as string | undefined;
  const node = [values.node_title, values.node_name, values.node_id]
    .find((value) => typeof value === "string" && value.trim()) as string | undefined;
  const code = [values.error_code, values.code]
    .find((value) => typeof value === "string" || typeof value === "number");
  return [
    node ? `节点“${node}”` : "",
    (message || "Coze 工作流执行失败").slice(0, 300),
    code !== undefined ? `错误码：${String(code)}` : "",
  ].filter(Boolean).join(" · ");
}

type StreamState = { contents: string[]; done: boolean };

function consumeBlock(block: string, state: StreamState) {
  const event = parseBlock(block);
  if (!event) return;
    const payload = eventPayload(event);
    const name = getEventName(event, payload);
    if (name === "ping" || name === "heartbeat" || event.data.trim().toUpperCase() === "PING") return;
    if (name === "error" || name === "failed" || name === "workflow_failed") throw new CozeStreamError(getWorkflowError(payload), "workflow");
    if (name === "message") {
      const content = getMessageContent(payload);
      if (content !== null) state.contents.push(content);
    }
    if (name === "done" || name === "completed" || name === "workflow_completed") state.done = true;
}

function parseContents(contents: string[]): unknown {
  for (let index = contents.length - 1; index >= 0; index -= 1) {
    try { return JSON.parse(contents[index]); } catch { /* try an earlier message or joined chunks */ }
  }
  if (contents.length > 1) {
    try { return JSON.parse(contents.join("")); } catch { /* handled below */ }
  }
  throw new CozeStreamError(contents.length ? "工作流返回内容不是有效 JSON" : "工作流未返回 Message 内容", "parse");
}

export function parseCozeSseText(text: string): unknown {
  const state: StreamState = { contents: [], done: false };
  for (const block of text.replace(/\r\n/g, "\n").split(/\n\n+/)) consumeBlock(block, state);
  return parseContents(state.contents);
}

export async function readCozeStream(stream: ReadableStream<Uint8Array>): Promise<unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const state: StreamState = { contents: [], done: false };
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    const blocks = buffer.split(/\n\n+/);
    buffer = blocks.pop() ?? "";
    for (const block of blocks) consumeBlock(block, state);
    if (state.done) {
      await reader.cancel();
      return parseContents(state.contents);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) consumeBlock(buffer, state);
  return parseContents(state.contents);
}
