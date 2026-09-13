import type { GraphData, LocateResult, RecognizedQuestion } from '../../types';

function normalized(text: string) {
  return text.toLowerCase().replace(/[\s`$\\{}()[\],，。！？、:：;；'"“”‘’]/g, '');
}

export function mockLocate(recognized?: RecognizedQuestion, graph?: GraphData | null): LocateResult {
  if (recognized && graph?.nodes.length) {
    const raw = recognized.problem_markdown;
    const aliases = /导数|求导|d\s*\\over\s*\{?d?x|\\frac\s*\{?d|\bd\s*\/\s*d?x\b/i.test(raw)
      ? ' 导数 求导'
      : '';
    const question = normalized(raw + aliases);
    const matched = graph.nodes
      .map((node) => {
        const terms = [node.name, ...(node.keywords ?? [])]
          .map(normalized)
          .filter((term) => term.length >= 2);
        const hits = terms.filter((term) => question.includes(term));
        return { node, score: hits.length + (question.includes(normalized(node.name)) ? 2 : 0) };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.node.level - a.node.level)
      .slice(0, 3);
    if (!matched.length) {
      return {
        seed_nodes: [],
        in_scope: false,
        coverage_confidence: 0.9,
        coverage_reason: '当前教材知识图谱中没有找到与该问题直接相关的知识点。',
      };
    }
    const max = matched[0].score;
    return {
      in_scope: true,
      coverage_confidence: 0.8,
      coverage_reason: '问题与当前知识图谱中的知识点存在明确匹配。',
      seed_nodes: matched.map(({ node, score }) => ({
        node_id: node.id,
        relevance: Math.max(0.45, score / max),
        reason: `题目与「${node.name}」相关`,
      })),
    };
  }
  return {
    seed_nodes: [],
    in_scope: false,
    coverage_confidence: 1,
    coverage_reason: '当前还没有可用于判断的教材知识图谱，请先导入教材。',
  };
}
