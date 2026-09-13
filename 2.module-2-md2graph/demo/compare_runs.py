# -*- coding: utf-8 -*-
"""三次建图结果对比脚本。

对多个 graph.json 与 gold_reference.json 计算：
  - 召回率、虚构节点、命名(id)一致性、边一致性、与金标边匹配率。

用法：
    python compare_runs.py a.json b.json c.json --gold ../input_example/gold_reference.json
"""
import argparse
import json
import os
import sys
from itertools import combinations


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def jaccard(a, b):
    if not a and not b:
        return 1.0
    return len(a & b) / len(a | b)


def edge_name_set(graph):
    """把边的端点映射到 name 空间，返回 { (src_name, dst_name, relation) }。"""
    id2name = {n["id"]: n["name"] for n in graph.get("nodes", [])}
    s = set()
    for e in graph.get("edges", []):
        src, dst = id2name.get(e.get("source")), id2name.get(e.get("target"))
        if src and dst:
            s.add((src, dst, e.get("relation")))
    return s


def undirected_pairs(edges):
    return {tuple(sorted((s, d))) for (s, d, r) in edges}


def compare(gold, runs):
    gold_names = {n["name"] for n in gold.get("nodes", [])}
    gold_edges = edge_name_set(gold)
    gold_pairs = undirected_pairs(gold_edges)

    per_run = []
    for run in runs:
        nodes = run.get("nodes", [])
        names = {n["name"] for n in nodes}
        ids = {n["id"] for n in nodes}
        edges = edge_name_set(run)
        pairs = undirected_pairs(edges)
        per_run.append({
            "node_count": len(nodes),
            "edge_count": len(run.get("edges", [])),
            "names": names,
            "ids": ids,
            "edges": edges,
            "pairs": pairs,
            "recall": round(len(names & gold_names) / len(gold_names), 4) if gold_names else 0,
            "hallucinated": sorted(names - gold_names),
            "missed": sorted(gold_names - names),
            "edge_exact_hit": len(edges & gold_edges),
            "edge_directionless_hit": len(pairs & gold_pairs),
            "edge_exact_precision": round(len(edges & gold_edges) / len(edges), 4) if edges else 0,
            "edge_directionless_recall": round(len(pairs & gold_pairs) / len(gold_pairs), 4) if gold_pairs else 0,
        })

    pair_consistency = []
    for i, j in combinations(range(len(per_run)), 2):
        a, b = per_run[i], per_run[j]
        pair_consistency.append({
            "pair": (i, j),
            "name_jaccard": round(jaccard(a["names"], b["names"]), 4),
            "id_jaccard": round(jaccard(a["ids"], b["ids"]), 4),
            "edge_jaccard": round(jaccard(a["edges"], b["edges"]), 4),
        })

    common_names = set.intersection(*(r["names"] for r in per_run)) if per_run else set()
    name2ids = {}
    for run in runs:
        for n in run.get("nodes", []):
            name2ids.setdefault(n["name"], []).append(n["id"])
    id_consistent = sum(1 for nm in common_names if len(set(name2ids.get(nm, []))) == 1)
    naming = {
        "common_names": len(common_names),
        "same_id_across_runs": id_consistent,
        "id_stability_rate": round(id_consistent / len(common_names), 4) if common_names else 0,
    }

    return per_run, pair_consistency, naming


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--gold", default=os.path.join("..", "input_example", "gold_reference.json"))
    args = ap.parse_args(argv)

    gold = load(args.gold)
    runs = [load(f) for f in args.files]
    per_run, pair_consistency, naming = compare(gold, runs)

    gold_edges = edge_name_set(gold)
    gold_pairs = undirected_pairs(gold_edges)

    print("=" * 70)
    print("三次建图结果对比报告")
    print("=" * 70)
    print(f"金标：节点 {len(gold['nodes'])}，边 {len(gold['edges'])}")
    for i, r in enumerate(per_run):
        print(f"\n[run {i}] {args.files[i]}")
        print(f"  节点 {r['node_count']}  边 {r['edge_count']}")
        print(f"  召回率(name) {r['recall']:.2%}  虚构节点 {len(r['hallucinated'])}  遗漏 {len(r['missed'])}")
        if r['hallucinated']:
            print(f"    虚构: {r['hallucinated']}")
        if r['missed']:
            print(f"    遗漏: {r['missed']}")
        print(f"  与金标边：精确命中 {r['edge_exact_hit']}/{len(gold_edges)}，"
              f"方向无关命中 {r['edge_directionless_hit']}/{len(gold_pairs)}")

    if pair_consistency:
        print("\n[两两一致性]")
        for pc in pair_consistency:
            print(f"  run{pc['pair'][0]} vs run{pc['pair'][1]}：name {pc['name_jaccard']:.2%}  "
                  f"id {pc['id_jaccard']:.2%}  边 {pc['edge_jaccard']:.2%}")

    print(f"\n[命名稳定性] 三次都出现的节点 {naming['common_names']} 个，"
          f"其中 id 完全相同 {naming['same_id_across_runs']} 个（{naming['id_stability_rate']:.2%}）")
    print("=" * 70)

    out = {"gold": {"nodes": len(gold["nodes"]), "edges": len(gold["edges"])},
           "runs": [{k: v for k, v in r.items() if k not in ("names", "ids", "edges", "pairs")}
                    for r in per_run],
           "pair_consistency": pair_consistency, "naming": naming}
    os.makedirs("../output_example", exist_ok=True)
    with open("../output_example/comparison_report.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2, default=str)
    print("已写入 ../output_example/comparison_report.json")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))