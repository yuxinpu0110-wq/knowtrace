# modules —— 各模块接入说明（7号总集成视角）

> 集成原则：**不重新开发模块，只定义接口并接线**。其他 6 人在此接入自己的实现；
> 在大家完成前，后端用 `backend/mock.js` 的 Mock 数据保证主链路可演示。

## 模块 ↔ 接口 ↔ 接入点总览

| 模块 | 职责 | 契约文件 | 后端接口 | 前端接入点 |
|---|---|---|---|---|
| 1号 | 知识图谱展示 + 神经元式点亮 | `graph.json` | 无（纯前端） | 已集成 ✅ |
| 2号 | Markdown → 知识图谱 | `graph.example.json` | `POST /api/graph/generate` | `frontend/src/api/api.ts#generateGraph` |
| 3号 | 题目图片识别（OCR） | `recognized_question.example.json` | `POST /api/question/recognize` | `api.ts#recognize` |
| 4号 | 题目 → 相关节点定位 | 输出 `seed_nodes[]` | `POST /api/question/locate` | `api.ts#locate` |
| 5号 | 诊断对话（多轮追问） | `diagnosis.example.json` | `POST /api/diagnosis/next` | `api.ts#diagnosisNext` |
| 6号 | 教学讲解 + 验证评估 | 教学/评估对象 | `POST /api/teaching/generate`、`POST /api/teaching/evaluate` | `api.ts#teachingGenerate` / `evaluate` |

## 各模块如何接入

### 1号（已集成）
产物即本仓库前端 `frontend/src/graph/`（`bfs.ts`、`lighting.ts`、`paintNode.ts`）与 `frontend/src/components/GraphPanel.tsx`。
- 直接读 `graph.json`（无 LLM 调用），本地 BFS 计算亮度 `max(0.15, 0.72^distance)`，3 跳封顶。
- 状态色优先级高于距离亮度；种子切换无颜色残留。
- 不需要改动，除非 1号 后续交付了新的绘制/动画实现再替换 `paintNode.ts`。

### 2号（图谱生成）
- **接入点**：`backend/mock.js` 的 `mockGraphGenerate()`。
- **要做**：把该函数替换为「读 `DEEPSEEK_API_KEY` 调 DeepSeek，输入 Markdown，输出 `graph.json`」。
- **约束**（来自 AGENTS.md）：密钥只从服务器环境变量读；不允许在浏览器端暴露 Key / 完整 Prompt / 模型原始推理；`node_id` 必须来自教材，不得创造不存在的 id。

### 3号（题目识别）
- **接入点**：`backend/mock.js` 的 `mockRecognize({ text })`。
- **要做**：替换为「接收图片 base64，调用视觉模型，输出 `recognized_question.json`」。
- 前端会额外传 `text`（用户手动粘贴的文字），无图时可降级用文字。

### 4号（节点定位）
- **接入点**：`backend/mock.js` 的 `mockLocate()`。
- **输入**：`recognized_question`；**输出**：`{ seed_nodes: [{ node_id, relevance, reason }] }`。
- 前端取 `seed_nodes[0].node_id` 作为点亮种子（蓝色），其余为推荐关联（紫色）。

### 5号（诊断对话）
- **接入点**：`backend/mock.js` 的 `mockDiagnosisNext({ round, question })`。
- **约定**：`round` 从 0 开始递增；返回 `next_question`（继续追问）或 `done: true` + `suspected_gap.node_id`（结束）。
- `done` 是本集成在契约上新增的**可选**字段，老模块不感知也不受影响。

### 6号（教学 + 验证）
- **接入点**：`backend/mock.js` 的 `mockTeachingGenerate({ node_id })` 与 `mockEvaluate({ node_id, answer })`。
- `teaching` 需含 `definition/intuition/relation/example/pitfall/verify_question`。
- `evaluate` 返回 `{ mastery, score, evidence, suggested_state }`，`suggested_state: green` 时前端把节点变绿并进入完成态。

## 响应封装（统一，前端零改动）

后端每个接口都返回：

```json
{ "ok": true, "mock": true, "data": { ... } }
```

失败时返回 `{ "ok": false, "error": { "code", "message" } }`。
正式接入后只需把 `mock` 置为 `false`（或删除该字段），前端自动按 `data` 渲染，无需改代码。

## 前端降级策略

`frontend/src/api/api.ts` 的 `call()`：
1. 用户开启「内置 Mock」→ 直接用 `frontend/src/api/mock.ts` 的前端缓存 Mock，不连后端。
2. 后端失败（超时/网络/5xx，重试一次后仍失败）→ 自动降级到前端 Mock，页面顶部显示「已降级到内置 Mock」。
3. 任何模块故障都不让整页崩溃（`useFlow` 用 try/catch 兜底并把错误显示在面板上）。
