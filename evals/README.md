# BrandFlow AI Evaluation Harness

这是一套独立于用户端的离线评测工具。它通过 BrandFlow API 执行 20 条固定样本，自动检查必含信息、禁用表达、风险状态、人工接管与任务完成情况，并生成 JSON、CSV 和 Markdown 报告。

## 运行

终端一：

```bash
npm run dev
```

终端二：

```bash
npm run eval:brandflow
```

常用参数：

```bash
npm run eval:brandflow -- --cases=BF-E001,BF-E006,BF-E011 --concurrency=1
npm run eval:brandflow -- --base-url=http://127.0.0.1:3010 --timeout-ms=360000
```

结果写入 `evals/results/<timestamp>-brandflow/`。该目录被 Git 忽略，避免把大量模型输出提交到仓库。

## 评分边界

自动评分适合快速定位结构性问题与明显风险，不能替代人工对文案质量、品牌语感或真实合规性的判断。结项时至少人工复核所有 Badcase 和 5 条正常样本。
