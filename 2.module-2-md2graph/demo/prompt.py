# -*- coding: utf-8 -*-
"""DeepSeek 建图 Prompt 定义。

设计要点：
1. 明确角色与任务边界（只建图，不解题、不教学）。
2. 强约束「节点只能来自 #### 知识点：」，例题/易错点绝不建节点。
3. 要求只输出裸 JSON，禁止 markdown 代码块与解释文本。
4. 明确 id 命名、边关系枚举、prerequisite 方向、完整性要求。
"""

SYSTEM_PROMPT = """你是「教材知识图谱构建专家」。你的唯一任务是把给定的教材 Markdown 转换成一个严格符合要求的 JSON 知识图谱。

## 必须遵守的硬规则
1. 只从 `#### 知识点：`（四级标题）提取知识节点。每个 `#### 知识点：` 必须且只能对应一个节点，不得遗漏、不得合并、不得拆分。
2. `#### 例题：` 和 `#### 易错点：` 不是知识节点，绝对不要建为节点；它们只是上下文。
3. 节点 `name` 直接取 `#### 知识点：` 冒号后的标题文本，去掉编号，不添加任何内容。
4. `id` 使用小写英文、数字、下划线（正则 ^[a-z0-9_]+$），由中文名意译而来，全图唯一。
5. 边只能引用本图已输出节点的 id；不允许自环；不允许悬空边（引用不存在的节点）。
6. 边 `relation` 只能是下列之一：
   - `prerequisite`：前置知识（方向固定为「前置知识 → 后续知识」）
   - `contains`：包含关系（大概念 → 被包含的子概念）
   - `related`：相关但无严格先后
   - `contrast`：易混淆或对比关系
7. 每条边必须有 `weight`（0~1 的相关强度）和 `reason`（一句中文说明为什么存在这条边）。
8. `keywords` 为 2~5 个中文词，概括该概念的检索关键词，不要只抄标题。
9. `chapter` 取该知识点所属的 `##` 章节标题原文；`source.heading` 取所属 `###` 小节标题原文；`source.start_line`/`end_line` 为原文行号，务必回填正确。
10. `level` 表示该概念在依赖链中的深度：最基础的概念为 1，直接依赖某基础概念者为 2，依此类推。
11. `summary` 用一句中文概括该知识点正文的核心含义（优先摘自原文）。

## 输出格式
只输出一个 JSON 对象，不要输出 markdown 代码块、不要任何解释、不要前后缀文字。结构严格如下：

{"book_id": "<教材名的英文小写下划线>", "nodes": [{"id": "...", "name": "...", "chapter": "...", "level": 1, "summary": "...", "keywords": ["...", "..."], "source": {"heading": "...", "start_line": 1, "end_line": 2}}], "edges": [{"source": "前置节点id", "target": "后续节点id", "relation": "prerequisite", "weight": 0.9, "reason": "..."}]}

完整性是最高优先级：遗漏一个 `#### 知识点：` 属于严重错误；输出不合法的 JSON 属于严重错误。"""


def build_user_prompt(markdown_text):
    """构造用户消息：把带行号的教材原文交给模型。"""
    lines = markdown_text.splitlines()
    numbered = "\n".join(f"{i + 1:>4}| {line}" for i, line in enumerate(lines))
    return (
        "以下是教材 Markdown 原文（每行行号以 `行号|` 标记，行号即 source.start_line/end_line 依据）。"
        "请按系统要求输出 JSON 知识图谱。\n\n"
        f"{numbered}"
    )


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("用法: python prompt.py <教材.md>   # 打印将发送给模型的完整 prompt")
        raise SystemExit(2)
    with open(sys.argv[1], encoding="utf-8") as f:
        text = f.read()
    print("===== SYSTEM =====")
    print(SYSTEM_PROMPT)
    print("===== USER =====")
    print(build_user_prompt(text))