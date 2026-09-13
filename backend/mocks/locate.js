// 4号 定位回退：即使真实适配器不可用，也不把超纲问题硬塞给固定节点。
function normalized(text) {
  return String(text || '').toLowerCase().replace(/[\s`$\\{}()[\],，。！？、:：;；'"“”‘’]/g, '');
}

export function mockLocate({ question, nodes } = {}) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return {
      in_scope: false,
      coverage_confidence: 1,
      coverage_reason: '当前还没有可用于判断的教材知识图谱，请先导入教材。',
      seed_nodes: [],
    };
  }

  const aliases = /导数|求导|d\s*\\over\s*\{?d?x|\\frac\s*\{?d|\bd\s*\/\s*d?x\b/i.test(String(question || ''))
    ? ' 导数 求导'
    : '';
  const q = normalized(String(question || '') + aliases);
  const matched = nodes
    .map((node) => {
      const terms = [node.name, ...(node.keywords || [])].map(normalized).filter((term) => term.length >= 2);
      const hits = terms.filter((term) => q.includes(term));
      return { node, score: hits.length + (q.includes(normalized(node.name)) ? 2 : 0) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || (b.node.level || 0) - (a.node.level || 0))
    .slice(0, 3);

  if (!matched.length) {
    return {
      in_scope: false,
      coverage_confidence: 0.88,
      coverage_reason: '当前教材知识图谱中没有找到与该问题直接相关的知识点。',
      seed_nodes: [],
    };
  }

  const max = matched[0].score;
  return {
    in_scope: true,
    coverage_confidence: 0.76,
    coverage_reason: '题目与当前知识图谱中的知识点存在明确匹配。',
    seed_nodes: matched.map(({ node, score }) => ({
      node_id: node.id,
      relevance: Math.max(0.45, score / max),
      reason: `题目与「${node.name}」相关`,
    })),
  };
}
