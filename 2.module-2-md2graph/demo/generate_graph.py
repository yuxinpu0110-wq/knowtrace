# -*- coding: utf-8 -*-
"""2号真实建图：调用 DeepSeek（OpenAI 兼容）把教材 Markdown 转为 graph.json。

仅依赖 Python 标准库（urllib），无 pip 依赖。需要 DEEPSEEK_API_KEY。
集成后端设置 GRAPH_REAL=1 且提供 DEEPSEEK_API_KEY 时走此脚本；否则走 mock_generate_graph.py。

用法：
    python generate_graph.py textbook.md -o graph.json [--max-calls 2] [--temperature 0]
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from prompt import SYSTEM_PROMPT, build_user_prompt  # noqa: E402


def load_dotenv():
    """读取 ../.env（若存在），不覆盖已设置的环境变量。"""
    p = os.path.join(HERE, "..", ".env")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def extract_json(content):
    """从模型输出中抽取裸 JSON（容忍 markdown 代码块包裹）。"""
    content = (content or "").strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
    if fence:
        content = fence.group(1).strip()
    # 截取最外层 { ... } 之间的内容
    s = content.find("{")
    e = content.rfind("}")
    if s != -1 and e != -1 and e > s:
        content = content[s:e + 1]
    return json.loads(content)


def call_deepseek(markdown, model, base, key, temperature):
    url = base.rstrip("/") + "/chat/completions"
    payload = {
        "model": model,
        "temperature": temperature,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_prompt(markdown)},
        ],
    }
    # JSON 输出（部分模型支持；不支持时服务端会忽略/报错，这里不强制）
    payload["response_format"] = {"type": "json_object"}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + key,
        },
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return extract_json(body["choices"][0]["message"]["content"])


def main(argv):
    ap = argparse.ArgumentParser(description="2号真实 DeepSeek 建图")
    ap.add_argument("input", help="教材 Markdown")
    ap.add_argument("-o", "--output", required=True)
    ap.add_argument("--max-calls", type=int, default=2)
    ap.add_argument("--temperature", type=float, default=0.0)
    args = ap.parse_args(argv)

    load_dotenv()
    key = os.environ.get("DEEPSEEK_API_KEY")
    if not key:
        sys.stderr.write("缺少 DEEPSEEK_API_KEY，请设置环境变量或改用 mock_generate_graph.py\n")
        return 2
    model = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
    base = os.environ.get("DEEPSEEK_API_BASE", "https://api.deepseek.com/v1")

    with open(args.input, encoding="utf-8") as f:
        markdown = f.read()

    graph = None
    for attempt in range(max(1, args.max_calls)):
        try:
            graph = call_deepseek(markdown, model, base, key, args.temperature)
            if isinstance(graph.get("nodes"), list) and isinstance(graph.get("edges"), list):
                break
        except Exception as e:
            sys.stderr.write(f"[generate_graph] 第 {attempt + 1} 次调用失败：{e}\n")
            if attempt + 1 >= args.max_calls:
                return 1
            time.sleep(1)

    if graph is None:
        sys.stderr.write("[generate_graph] 未获得合法图谱\n")
        return 1

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(graph, f, ensure_ascii=False, indent=2)
    print(f"[generate_graph] 节点 {len(graph.get('nodes', []))} 边 {len(graph.get('edges', []))} -> {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
