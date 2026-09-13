import { chatJson, hasKey } from './deepseek.js';
import { getGraph } from './state.js';

const ANSWER_SYSTEM_PROMPT = `你是 KnowTrace 的解题助手。请先直接回答用户的问题，再简要说明关键步骤。

硬规则：
1. 只能使用提供的教材知识点作为依据，不得假装知道教材未覆盖的内容。
2. 所有数学变量、表达式、公式、函数和数值关系必须使用 LaTeX：行内用 $...$，独立公式用 $$...$$。
3. 回答简洁、完整、面向学生，不要在答案中进行前置知识诊断。
4. 只输出 JSON：{"answer_markdown":"...","confidence":0.0}。`;

function fallbackAnswer(question, nodes) {
  const text = String(question || '');
  const point = text.match(/x\s*=\s*(-?\d+(?:\.\d+)?)/i)?.[1];
  if (/sin\s*x|正弦/i.test(text)) {
    if (point !== undefined) {
      const value = Math.cos(Number(point));
      return `正弦函数的导数为 $$\\frac{d}{dx}\\sin x=\\cos x.$$ 因此在 $x=${point}$ 处，$$f'(${point})=\\cos(${point})\\approx ${value.toFixed(4)}.$$（角度采用弧度制。）`;
    }
    return '正弦函数的导数为 $$\\frac{d}{dx}\\sin x=\\cos x.$$';
  }
  if (/cos\s*x|余弦/i.test(text)) {
    return '余弦函数的导数为 $$\\frac{d}{dx}\\cos x=-\\sin x.$$';
  }
  if (/x\s*\^?\s*2|x²/i.test(text) && /导数|求导|d\s*\\over|\\frac\s*\{?d/i.test(text)) {
    return '对于 $f(x)=x^2$，有 $$f\'(x)=2x.$$ 将题目给出的 $x$ 值代入即可得到该点的导数。';
  }
  const context = nodes.map((node) => `**${node.name}**：${node.summary}`).join('\n\n');
  return `${context}\n\n根据以上教材内容，先列出题目的已知条件与目标，再选择对应定义或规则逐步推导。`;
}

export async function answerQuestion({ question, seed_nodes } = {}) {
  const graph = getGraph();
  const ids = new Set((seed_nodes || []).map((seed) => seed.node_id));
  const nodes = (graph?.nodes || []).filter((node) => ids.has(node.id));
  if (!question || !nodes.length) throw new Error('缺少题目或相关知识点');

  if (hasKey()) {
    const context = nodes.map((node) => ({ id: node.id, name: node.name, summary: node.summary, keywords: node.keywords }));
    const result = await chatJson({
      system: ANSWER_SYSTEM_PROMPT,
      user: `题目：${question}\n\n教材相关知识点：${JSON.stringify(context, null, 2)}`,
      temperature: 0.15,
    });
    if (typeof result.answer_markdown === 'string' && result.answer_markdown.trim()) {
      return {
        answer_markdown: result.answer_markdown.trim(),
        confidence: Math.min(1, Math.max(0, Number(result.confidence) || 0.75)),
        source_node_ids: nodes.map((node) => node.id),
      };
    }
  }

  return {
    answer_markdown: fallbackAnswer(question, nodes),
    confidence: 0.62,
    source_node_ids: nodes.map((node) => node.id),
  };
}
