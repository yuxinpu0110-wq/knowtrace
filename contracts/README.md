# contracts —— 接口契约的唯一数据源

本目录是**冻结接口**。任何模块都不得删除、改名或改变已有字段的含义；新字段默认必须是可选字段。

> 注意：`graph.example.json` 用的是 20 节点微积分图谱（比最小示例更丰富），它同时作为演示数据被后端 `POST /api/graph/generate` 的 Mock 实现返回。字段结构完全符合冻结契约。

## 三个文件

| 文件 | 含义 | 生产者 |
|---|---|---|
| `graph.example.json` | 教材知识图谱 | 2号（Markdown → graph） |
| `recognized_question.example.json` | 题目识别结果 | 3号（OCR/视觉） |
| `diagnosis.example.json` | 诊断结果（含激活节点与薄弱点） | 5号（诊断对话） |

## 字段速览

### graph.json

```json
{
  "book_id": "calculus_demo",
  "nodes": [{ "id", "name", "chapter", "level", "summary", "keywords", "source": { "heading", "start_line", "end_line" } }],
  "edges": [{ "source", "target", "relation", "weight", "reason" }]
}
```

- `id` 唯一，小写英文/数字/下划线；`source`/`target` 必须引用已有节点；不允许自环。
- `relation` ∈ `prerequisite` | `contains` | `related` | `contrast`；`prerequisite` 方向固定为「前置知识 → 后续知识」。
- 每条边必须有 `reason`。

### recognized_question.json

```json
{ "problem_markdown", "subject", "image_quality", "confidence", "uncertain_spans": [{ "text", "reason" }] }
```

### diagnosis.json

```json
{
  "question", "seed_nodes": [{ "node_id", "relevance", "reason" }],
  "suspected_gap": { "node_id", "confidence", "reason" },
  "activated_nodes": [{ "node_id", "distance", "brightness", "state" }],
  "next_question"
}
```

- 视觉状态 `state` ∈ `inactive` | `question_related` | `suspected_gap` | `mastered` | `recommended`。
- 本集成在 `diagnosis.json` 上新增**可选**字段 `done: boolean`（表示诊断是否结束），不破坏旧模块。

## 变更流程

任何接口变更须先写清原因、影响模块与迁移方式，经总负责人（7号）同意后再改。
