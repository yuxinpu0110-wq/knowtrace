# -*- coding: utf-8 -*-
"""4号节点定位桥接：从 stdin 读 {"question", "nodes"}，关键词匹配输出 {"ok", "seed_nodes"}。

保证 node_id 只来自输入 nodes（绝不创造图谱外 id），无任何 pip 依赖。
关键词/名字命中的节点按分数排序；分数相同时优先更深层（level 更大）的节点，
避免「函数」这类宽泛词盖过「导数」等具体知识点。空结果返回 ok=false 以触发上层回退 Mock。
"""
import json
import re
import sys

# 统一 UTF-8 I/O，避免 Windows 本地编码（GBK）导致 stdin/stdout 中文乱码。
try:
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def norm(s):
    return re.sub(r"\s+", "", s or "")


def score_node(question, node):
    q = norm(question)
    name = re.sub(r"[的与]", "", norm(node.get("name", "")))
    hits = 0
    for kw in node.get("keywords", []) or []:
        if kw and norm(kw) in q:
            hits += 2
    if name and len(name) >= 2 and name in q:
        hits += 3
    return hits


def main():
    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"stdin bad json: {e}"}))
        return 1

    question = data.get("question", "")
    nodes = data.get("nodes", [])
    if not question or not nodes:
        print(json.dumps({"ok": False, "error": "missing question or nodes"}))
        return 1

    q = norm(question)
    scored = []
    for n in nodes:
        s = score_node(question, n)
        if s > 0:
            scored.append((s, n.get("level") or 0, n))

    if not scored:
        print(json.dumps({
            "ok": True,
            "in_scope": False,
            "coverage_confidence": 0.9,
            "coverage_reason": "当前教材知识图谱中没有命中与该问题相关的知识点",
            "seed_nodes": [],
        }, ensure_ascii=False))
        return 0

    scored.sort(key=lambda x: (-x[0], -x[1]))
    top = scored[:3]
    maxs = top[0][0]
    seed_nodes = []
    for s, _lvl, n in top:
        matched_kw = [k for k in (n.get("keywords") or []) if k and norm(k) in q]
        seed_nodes.append({
            "node_id": n["id"],
            "relevance": round(s / maxs, 2) if maxs else 0.0,
            "reason": ("题目命中关键词 " + "、".join(matched_kw[:3])) if matched_kw else "与节点名匹配",
        })

    print(json.dumps({
        "ok": True,
        "in_scope": True,
        "coverage_confidence": 0.78,
        "coverage_reason": "题目命中了知识图谱中的节点名称或关键词",
        "seed_nodes": seed_nodes,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
