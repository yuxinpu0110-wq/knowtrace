export function mockAnswerQuestion({ question, seed_nodes, nodes } = {}) {
  const ids = new Set((seed_nodes || []).map((seed) => seed.node_id));
  const related = (nodes || []).filter((node) => ids.has(node.id));
  const text = String(question || '');
  const point = text.match(/x\s*=\s*(-?\d+(?:\.\d+)?)/i)?.[1];
  let answer;
  if (/sin\s*x|正弦/i.test(text)) {
    answer = point === undefined
      ? '正弦函数的导数为 $$\\frac{d}{dx}\\sin x=\\cos x.$$'
      : `正弦函数的导数为 $\\cos x$，因此在 $x=${point}$ 处，$$f'(${point})=\\cos(${point})\\approx ${Math.cos(Number(point)).toFixed(4)}.$$（弧度制）`;
  } else if (/cos\s*x|余弦/i.test(text)) {
    answer = '余弦函数的导数为 $$\\frac{d}{dx}\\cos x=-\\sin x.$$';
  } else {
    answer = related.map((node) => `**${node.name}**：${node.summary}`).join('\n\n') || '当前教材信息不足，暂时无法生成可靠答案。';
  }
  return {
    answer_markdown: answer,
    confidence: /sin|cos|正弦|余弦/i.test(text) ? 0.96 : 0.6,
    source_node_ids: related.map((node) => node.id),
  };
}
