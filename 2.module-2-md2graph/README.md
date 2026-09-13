# 2号：Markdown → 知识图谱（DeepSeek 建图验证）

验证 DeepSeek 能否把教材 Markdown 稳定转换成符合统一契约的 `graph.json`。

不负责画图、不负责回答题目；只负责「输入规范 + 建图 + 校验 + 稳定性对比」。

## 1. 结论速览

> 见 `feasibility_report.md`（含「是否需要人工确认页」的结论与数据）。

## 2. 目录结构

```text
module-2-md2graph/
├── README.md                  # 本文件
├── .env.example               # 环境变量模板（复制为 .env 使用）
├── docs/
│   └── markdown_input_spec.md # 严格的教材 Markdown 输入规范
├── demo/                      # 可运行程序（仅依赖 Python3 标准库）
│   ├── prompt.py              # DeepSeek Prompt 定义
│   ├── generate_graph.py      # 主程序：真实调用 DeepSeek 建图
│   ├── mock_generate_graph.py # 离线兜底：规则确定性建图
│   ├── validate_graph.py      # graph.json 本地校验
│   ├── compare_runs.py        # 多次结果对比（召回/命名/边一致性）
│   └── schema.json            # graph.json 的 JSON Schema
├── input_example/
│   ├── textbook_calculus.md   # 测试教材（25 知识点 + 例题/易错点干扰）
│   └── gold_reference.json    # 人工标注金标图（25 节点 / 25 边）
└── output_example/            # 生成结果与对比报告
```

## 3. 依赖与环境变量

- 仅需 **Python 3.8+ 标准库**，无 pip 依赖。
- 密钥：优先环境变量 `DEEPSEEK_API_KEY`，其次读取项目根 `.env`。
  真实调用前必须提供密钥：

```bash
# 方式一：环境变量（Windows PowerShell）
$env:DEEPSEEK_API_KEY="sk-xxxx"

# 方式二：本地 .env
cp .env.example .env   # 然后填入真实 Key
```

无 Key 时程序会明确报错并提示使用 Mock。

## 4. 快速开始

```bash
cd module-2-md2graph/demo

# ① 校验一份 graph.json
python validate_graph.py ../output_example/mock_graph.json

# ② 离线兜底：规则建图（不需要 Key）
python mock_generate_graph.py

# ③ 真实建图：调用 DeepSeek（需要 Key）
python generate_graph.py ../input_example/textbook_calculus.md -o ../output_example/run1.json

# ④ 连续生成 3 次（对比稳定性用）
python generate_graph.py ../input_example/textbook_calculus.md -o ../output_example/run1.json
python generate_graph.py ../input_example/textbook_calculus.md -o ../output_example/run2.json
python generate_graph.py ../input_example/textbook_calculus.md -o ../output_example/run3.json

# ⑤ 三次结果对比
python compare_runs.py ../output_example/run1.json ../output_example/run2.json ../output_example/run3.json
```

## 5. 各脚本说明

| 脚本 | 作用 | 是否需要 Key |
|---|---|---|
| `validate_graph.py` | 校验 id 合法性/重复、悬空边、自环、relation 枚举、必填字段 | 否 |
| `mock_generate_graph.py` | 规则解析 `#### 知识点：` 建图，复用金标 id 与边 | 否 |
| `generate_graph.py` | 真实调用 DeepSeek；校验失败自动重试（默认最多 2 次） | 是 |
| `compare_runs.py` | 召回率 / 命名一致性 / 边一致性 / 金标匹配率 | 否 |

`generate_graph.py` 关键参数：

- `-o`：输出路径
- `--max-calls`：最多调用次数（默认 2，含校验失败重试）
- `--temperature`：采样温度（默认 0，追求稳定）

## 6. 校验规则

`validate_graph.py` 自动检查：

1. id 重复 / 非法（须 `^[a-z0-9_]+$`）
2. 边引用不存在的节点（悬空边）
3. 自环
4. relation ∈ {prerequisite, contains, related, contrast}
5. 节点/边/嵌套 source 的必填字段缺失
6. weight 超范围、level 非数字

## 7. 输入示例与金标

- `input_example/textbook_calculus.md`：25 个 `#### 知识点：`，另含 4 例题 + 2 易错点作干扰项（用于验证模型**不会**把例题/易错点误建为节点）。
- `input_example/gold_reference.json`：人工标注的 25 节点 / 25 边金标，用于计算召回率与边匹配率，也供 Mock 建图复用。

## 8. 交付位置

- 代码/输入样例/输出示例：本目录
- 输入规范：`docs/markdown_input_spec.md`
- 可行性结论：`feasibility_report.md`