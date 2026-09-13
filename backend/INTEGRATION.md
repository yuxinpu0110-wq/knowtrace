# 后端真实模块集成说明（7号 + 各模块）

本目录已把 1～6 号的**真实模块**接入到总集成后端，替换原先 `mock.js` 的纯写死数据。
主链路从「Markdown 教材」开始即可在线跑通真实模块；第 3 步（OCR）因 3号未交付，用文字输入兜底。

## 一、接入总览

| 模块 | 职责 | 接口 | 适配器 | 真实实现 | 回退 Mock |
|---|---|---|---|---|---|
| 2号 | Markdown → 图谱 | `POST /api/graph/generate` | `adapters/graph.js` | spawn `2.module-2-md2graph/demo/mock_generate_graph.py`（离线规则） | `mock.js#mockGraphGenerate` |
| 3号 | 题目识别 | `POST /api/question/recognize` | 无（缺 OCR） | 文字兜底 | `mock.js#mockRecognize` |
| 4号 | 题目 → 节点定位 | `POST /api/question/locate` | `adapters/locate.js` + `locate_bridge.py` | spawn 桥接调 `4.*/demo/mock_matcher.py`（关键词） | `mock.js#mockLocate` |
| 5号 | 多轮诊断 | `POST /api/diagnosis/next` | `adapters/diagnosis.js` | JS 移植 5号诊断引擎（候选追溯+置信度+BFS） | `mock.js#mockDiagnosisNext` |
| 6号 | 教学 + 评估 | `POST /api/teaching/generate`、`/evaluate` | `adapters/teaching.js` | JS 移植 6号教学库+评分 | `mock.js#mockTeachingGenerate/Evaluate` |

每个接口统一 `serve()` 接线：**先真实模块，失败自动回退 Mock**（后端 `console` 打印 `[adapter]` 日志），保证演示不崩溃。

## 二、关键设计决策

### 1. 节点 ID 命名空间对齐（最重要）

各模块独立验证时的样例图互不一致，导致 `node_id` 对不上。集成时把 `contracts/graph.example.json`（20 节点）作为**唯一金标**：

- 2号建图时传入 `--gold contracts/graph.example.json`，使 mock 建图产出的 `node_id` 与冻结契约、与前端、与 4/5/6 号完全一致。
- 4号定位在图谱节点上做关键词匹配，天然不会造出图谱外的 id。
- 6号教学库用同一套 `node_id`（`limit_definition`、`derivative_definition` …）命名。

### 2. 5号：从交互式 HTML → 后端 round-based

5号本是纯前端 HTML（三层答案+模糊+不会+自主输入+实时面板）。集成到后端后：

- 前端第 6 步仍是「文字回答」，后端把文字按 5号的关键词启发式（`judgeAnswer`）判为 `correct/partial/wrong/fuzzy`，套用置信度因子 `0.35/0.70/1.50/1.10/1.45`。
- 候选断点沿 `prerequisite` 向前追溯；本地 BFS（3 跳）计算 `distance`/`brightness=max(0.15, 0.72^d)`——与原 HTML 的引擎一致，未交由大模型。

### 3. 6号：字段映射 + 扩充教学库

6号的 lesson 字段 → 7号冻结契约字段：

| 6号（`nodes.ts`） | 7号契约（`types.ts` `Teaching`） |
|---|---|
| `relation_to_problem` | `relation` |
| `minimal_example` | `example` |
| `common_pitfall` | `pitfall` |
| `verification_question` | `verify_question` |
| `verification.expected_answer` | 内部评分用，不回传前端 |

`6.tutor/src/teaching/nodes.ts` 已追加 `derivative_definition`、`function_definition`、`continuity`、`sequence_limit` 四个节点，使教学库覆盖图谱中诊断会命中的前置断点。`adapters/teaching.js` 另维护一份等价 JS 教学库（含数值/表达式答案），专供后端前端演示。

## 三、验证方法

### Python 侧（无需 Node，已真实跑通）

```bash
cd backend
python scripts/verify_modules.py
```

输出 2号建图（20 节点 / 22 边）与 4号定位 `seed_nodes`，验证两模块可离线真实串联。

### 全链路（需 Node ≥ 18）

```bash
cd backend && npm install && npm start        # 后端 3001
cd frontend && npm install && npm run dev     # 前端 5173
```

浏览器走 10 步主链路；后端日志会打印 `[adapter] xxx 真实模块完成`，证明真实调用而非纯 Mock。

## 四、已知风险与降级

1. **4号 Mock 定位 Top-1 可能不准**：关键词匹配会因题目含「函数」二字，把 `function_definition` 与 `derivative_definition` 都判 1.0 且前者可能排前（4号 README 已声明 Mock 语义弱）。真实 DeepSeek 定位（`deepseek_client.py`，需 `requests`+Key）更准，作为后续升级，已在 `locate_bridge.py` 留注释。
2. **3号 OCR 缺失**：识别环节只能靠前端「题目文字」输入；图片仅预览不参与识别。
3. **2号真实 DeepSeek 建图**：设置 `GRAPH_REAL=1` 且提供 `DEEPSEEK_API_KEY` 时走 `generate_graph.py`，其 `node_id` 由模型生成、可能与金标不一致，此时 4/5 号基于「当前图」工作，6号教学库可能落空（教学环节自动降级占位）。
4. **Node 环境**：本机当前 shell 无 Node，上述 Python 验证已跑通；Node 全链路验证需在装有 Node 的机器执行。