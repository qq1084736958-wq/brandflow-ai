import { describe, expect, it } from "vitest";
import { CozeStreamError, parseCozeSseText, readCozeStream } from "../src/lib/server/coze-stream";
import { unwrapWorkflowOutput } from "../src/lib/server/run-coze-workflow";

describe("parseCozeSseText", () => {
  it("忽略 PING 并解析 Message.message.content", () => {
    const stream = [
      'data: {"event":"PING"}',
      '',
      'data: {"event":"Message","message":{"content":"{\\"final_content\\":\\"完成\\",\\"risk_level\\":\\"低\\"}"}}',
      '',
      'data: {"event":"Done"}',
    ].join("\n");
    expect(parseCozeSseText(stream)).toEqual({ final_content: "完成", risk_level: "低" });
  });

  it("支持 event 行与直接 content", () => {
    const stream = 'event: Message\ndata: {"content":"{\\"review_result\\":\\"通过\\"}"}\n\n';
    expect(parseCozeSseText(stream)).toEqual({ review_result: "通过" });
  });

  it("将工作流错误转换为明确异常", () => {
    const stream = 'data: {"event":"Error","message":"节点执行失败"}\n\n';
    expect(() => parseCozeSseText(stream)).toThrowError(CozeStreamError);
  });

  it("在失败信息中保留 Coze 节点和错误码", () => {
    const stream = 'data: {"event":"workflow_failed","node_title":"风险修正","error_code":"NODE_TIMEOUT","error_message":"节点执行超时"}\n\n';
    expect(() => parseCozeSseText(stream)).toThrow(
      "节点“风险修正” · 节点执行超时 · 错误码：NODE_TIMEOUT",
    );
  });

  it("拒绝非 JSON Message.content", () => {
    const stream = 'data: {"event":"Message","message":{"content":"not json"}}\n\n';
    expect(() => parseCozeSseText(stream)).toThrow("工作流返回内容不是有效 JSON");
  });

  it("收到 Done 后无需等待连接关闭", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: Message\ndata: {"content":"{\\"final_content\\":\\"完成\\"}"}\n\nevent: Done\ndata: {}\n\n'));
      },
    });
    await expect(readCozeStream(stream)).resolves.toEqual({ final_content: "完成" });
  });
});

describe("unwrapWorkflowOutput", () => {
  it("递归解包 Coze 的双重 JSON 字符串 output", () => {
    const finalResult = {
      final_content: { scenes: [{ scene_no: 1, voiceover: "测试旁白" }] },
      review_result: "blocked",
      revision_result: "revised",
      risk_level: "high",
      review_report: "{}",
      human_review_req: "yes",
    };
    const response = {
      output: JSON.stringify(JSON.stringify(finalResult)),
    };

    expect(unwrapWorkflowOutput(response)).toEqual(finalResult);
  });

  it("保留无法解析的普通字符串 output 包装", () => {
    const response = { output: "plain text" };
    expect(unwrapWorkflowOutput(response)).toEqual(response);
  });
});
