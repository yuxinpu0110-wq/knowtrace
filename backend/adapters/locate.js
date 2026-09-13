// 4号模块适配：题目 -> 相关节点定位（seed_nodes）。
// 有 DEEPSEEK_API_KEY 时用 DeepSeek 从图谱节点中选 1~3 个最相关节点，并判断是否在覆盖范围内；
// 无 key 或调用失败时回退 locate_bridge.py 关键词匹配（Mock 兜底）。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPython, parseJson } from './util.js';
import { chatJson, hasKey } from './deepseek.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE_PY = path.join(__dirname, 'locate_bridge.py');

const LOCATE_SYSTEM_PROMPT = `你是「题目—知识点定位专家」。给定一道题目和一张知识图谱的节点列表，找出与题目最相关的 1~3 个知识点节点。

硬规则：
1. node_id 只能从给定节点的 id 中选取，绝不杜撰不存在的 id。
2. 按相关度从高到低排序，最多 3 个；relevance 取 0~1 的小数。
3. reason 用一句中文说明为什么该节点与题目相关。
4. 先判断问题是否可用当前知识图谱回答。只有当问题与图谱内容完全无关时才判 in_scope=false 且 seed_nodes 必须为空；
   只要问题能用图谱中某个知识点（或其近义说法）回答，即使表述简短、未逐字命中关键词，也应判 in_scope=true
   并匹配最相关的节点。宁可在可回答时判为可回答，也不要因措辞简短而误判为超纲。
5. coverage_confidence 表示覆盖判断置信度（0~1），coverage_reason 用一句中文解释判断。
6. 只输出一个 JSON 对象：{"in_scope":true,"coverage_confidence":0.9,"coverage_reason":"...","seed_nodes":[{"node_id":"...","relevance":0.9,"reason":"..."}]}，不要代码块、不要解释。`;

function buildLocateUserPrompt(question, nodes) {
  const list = nodes.map((n) => ({
    id: n.id,
    name: n.name,
    level: n.level,
    summary: n.summary,
    keywords: n.keywords,
  }));
  return `题目：${question}\n\n候选知识点节点：\n${JSON.stringify(list, null, 2)}\n\n请选出与题目最相关的 1~3 个节点。`;
}

function enrichQuestion(question) {
  let enriched = String(question || '');
  if (/导数|求导|d\s*\\over\s*\{?d?x|\\frac\s*\{?d|\bd\s*\/\s*d?x\b/i.test(enriched)) {
    enriched += ' 导数 求导';
  }
  if (/sin\s*x|正弦/i.test(enriched)) enriched += ' 正弦函数 三角函数';
  if (/cos\s*x|余弦/i.test(enriched)) enriched += ' 余弦函数 三角函数';
  return enriched;
}

export async function locate(question, nodes) {
  if (typeof question !== 'string' || !question.trim()) throw new Error('缺少题目文本');
  if (!Array.isArray(nodes) || nodes.length === 0) throw new Error('缺少图谱节点');

  if (hasKey()) {
    try {
      const res = await chatJson({ system: LOCATE_SYSTEM_PROMPT, user: buildLocateUserPrompt(question, nodes) });
      if (res.in_scope === false) {
        return {
          in_scope: false,
          coverage_confidence: Math.min(1, Math.max(0, Number(res.coverage_confidence) || 0.75)),
          coverage_reason: String(res.coverage_reason || '该问题不在当前知识图谱覆盖范围内').slice(0, 180),
          seed_nodes: [],
        };
      }
      const validIds = new Set(nodes.map((n) => n.id));
      const seeds = (res.seed_nodes || [])
        .filter((s) => s && validIds.has(s.node_id))
        .slice(0, 3)
        .map((s) => ({
          node_id: s.node_id,
          relevance: Math.min(1, Math.max(0, Number(s.relevance) || 0.5)),
          reason: String(s.reason || '').slice(0, 120),
        }));
      if (seeds.length) return {
        in_scope: true,
        coverage_confidence: Math.min(1, Math.max(0, Number(res.coverage_confidence) || 0.75)),
        coverage_reason: String(res.coverage_reason || '问题与当前知识图谱存在匹配').slice(0, 180),
        seed_nodes: seeds,
      };
    } catch (e) {
      console.warn(`[locate] DeepSeek 定位失败，回退关键词匹配：${e.message}`);
    }
  }

  const out = runPython(BRIDGE_PY, [], { input: JSON.stringify({ question: enrichQuestion(question), nodes }) });
  const res = parseJson(out, '4号输出');
  if (!res.ok) throw new Error(res.error || '4号定位失败');
  return {
    seed_nodes: res.seed_nodes ?? [],
    in_scope: res.in_scope !== false && (res.seed_nodes ?? []).length > 0,
    coverage_confidence: Number(res.coverage_confidence) || 0.75,
    coverage_reason: String(res.coverage_reason || ''),
  };
}
