# -*- coding: utf-8 -*-
"""严格按照 Markdown H1-H4 标题层级构建知识图谱。"""
import argparse
import hashlib
import json
import re
import sys


def clean_title(title):
    """移除可选的数字编号，保留知识点名称。"""
    return re.sub(r"^\s*\d+(?:\.\d+)*[.、]?\s*", "", title).strip()


def plain_summary(lines):
    text = " ".join(line.strip() for line in lines if line.strip() and not line.lstrip().startswith("#"))
    text = re.sub(r"!\[[^]]*]\([^)]*\)", "", text)
    text = re.sub(r"\[([^]]+)]\([^)]*\)", r"\1", text)
    text = re.sub(r"^[>*+\-]\s*", "", text)
    return re.sub(r"\s+", " ", text).strip()[:180]


def stable_id(path, used):
    base = "kp_" + hashlib.sha1(" / ".join(path).encode("utf-8")).hexdigest()[:12]
    node_id = base
    suffix = 2
    while node_id in used:
        node_id = f"{base}_{suffix}"
        suffix += 1
    used.add(node_id)
    return node_id


def parse_headings(markdown):
    lines = markdown.splitlines()
    candidates = []
    in_fence = False
    fence_marker = None
    for index, line in enumerate(lines):
        fence = re.match(r"^\s*(```|~~~)", line)
        if fence:
            marker = fence.group(1)
            if not in_fence:
                in_fence, fence_marker = True, marker
            elif marker == fence_marker:
                in_fence, fence_marker = False, None
            continue
        if in_fence:
            continue
        match = re.match(r"^(#{1,6})\s+(.+?)\s*$", line)
        if not match:
            continue
        level = len(match.group(1))
        if level > 4:
            raise ValueError(f"第 {index + 1} 行使用了 H{level}，知识图谱最多支持四层（# 到 ####）")
        raw = match.group(2).strip()
        name = clean_title(raw)
        if not name:
            raise ValueError(f"第 {index + 1} 行的标题没有知识点名称")
        candidates.append({
            "level": level,
            "raw": raw,
            "name": name,
            "line": index + 1,
            "index": index,
        })
    headings = []
    for position, item in enumerate(candidates):
        end = candidates[position + 1]["index"] if position + 1 < len(candidates) else len(lines)
        headings.append({
            **item,
            "end": end,
            "summary": plain_summary(lines[item["index"] + 1:end]),
        })
    return headings


def main(argv):
    parser = argparse.ArgumentParser(description="Markdown 四层知识图谱生成器")
    parser.add_argument("-i", "--input", required=True)
    parser.add_argument("-o", "--output", required=True)
    # 兼容旧调用参数；纯层级建图不使用金标或模型。
    parser.add_argument("--gold", default=None)
    parser.add_argument("--nodes-only", action="store_true")
    args = parser.parse_args(argv)

    with open(args.input, encoding="utf-8") as source:
        markdown = source.read()
    try:
        headings = parse_headings(markdown)
    except ValueError as exc:
        sys.stderr.write(str(exc) + "\n")
        return 2
    if not headings:
        sys.stderr.write("Markdown 中没有找到知识点标题（# 到 ####）\n")
        return 2
    if headings[0]["level"] != 1:
        sys.stderr.write(f"第一个知识点必须使用一级标题 #，当前是 H{headings[0]['level']}\n")
        return 2

    used = set()
    nodes = []
    edges = []
    stack_ids = {}
    stack_names = {}

    for item in headings:
        level = item["level"]
        if level > 1 and level - 1 not in stack_ids:
            sys.stderr.write(
                f"第 {item['line']} 行标题从上级直接跳到了 H{level}；"
                f"请先添加 H{level - 1} 母知识点\n"
            )
            return 2

        path = [stack_names[i] for i in range(1, level) if i in stack_names] + [item["name"]]
        node_id = stable_id(path, used)
        parent_id = stack_ids.get(level - 1)
        nodes.append({
            "id": node_id,
            "name": item["name"],
            "chapter": path[0],
            "level": level,
            "summary": item["summary"] or f"{item['name']}的核心内容。",
            "keywords": [item["name"]],
            "source": {
                "heading": item["raw"],
                "start_line": item["line"],
                "end_line": item["end"],
            },
        })
        if parent_id and not args.nodes_only:
            edges.append({
                "source": parent_id,
                "target": node_id,
                "relation": "contains",
                "weight": 1.0,
                "reason": f"Markdown 直接父子层级：H{level - 1} → H{level}",
            })

        stack_ids[level] = node_id
        stack_names[level] = item["name"]
        for deeper in range(level + 1, 5):
            stack_ids.pop(deeper, None)
            stack_names.pop(deeper, None)

    root_names = [node["name"] for node in nodes if node["level"] == 1]
    book_key = " / ".join(root_names)
    output = {
        "book_id": "book_" + hashlib.sha1(book_key.encode("utf-8")).hexdigest()[:10],
        "nodes": nodes,
        "edges": edges,
        "generation": {
            "nodes": "markdown_h1_h4",
            "relationships": "direct_parent_child",
            "max_depth": 4,
        },
    }
    with open(args.output, "w", encoding="utf-8") as target:
        json.dump(output, target, ensure_ascii=False, indent=2)
    print(f"[Markdown 层级建图] 节点 {len(nodes)} 边 {len(edges)} -> {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
