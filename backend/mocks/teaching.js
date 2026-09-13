// 6号 教学 + 验证 Mock。
import { loadGraph } from './shared.js';

const TEACHING = {
  limit_definition: {
    definition: '极限描述函数值在自变量趋近某一点时的变化趋势。',
    intuition: '把 x 一步步靠近目标点，观察函数值越来越接近哪个常数，而不是直接把那个点代入。',
    relation: '求导时差商要取 h→0 的极限，正是极限概念的直接应用——你卡住的这一步就是这里。',
    example: 'lim_{x→1} (x²-1)/(x-1) = lim_{x→1} (x+1) = 2。',
    pitfall: '不能直接把 h=0 代入差商；要先化简、约去公因子，再取极限。',
    verify_question: '计算 lim_{x→2} (x²-4)/(x-2)。',
    verify_options: ['$2$', '$3$', '$4$', '$6$', '$8$'],
  },
};

export function mockTeachingGenerate({ node_id } = {}) {
  const graph = loadGraph();
  const node = graph.nodes.find((n) => n.id === node_id);
  const t = TEACHING[node_id];
  return t
    ? { node_id, ...t }
    : {
        node_id: node_id ?? 'unknown',
        definition: node ? `${node.summary}` : '（通用定义占位）',
        intuition: '从直觉上理解该概念，并把它与题目联系起来。',
        relation: '该概念是当前题目某一步的前置知识。',
        example: '（示例占位，正式接入 6号后由教材证据生成）',
        pitfall: '常见误区：跳过关键步骤直接套结论。',
        verify_question: '（验证题占位）',
        verify_options: ['A', 'B', 'C', 'D', 'E'],
      };
}

// 验证题正确答案为「4」；Mock 按答案是否命中判断，用于演示“绿 / 橙”两种结果。
export function mockEvaluate({ node_id, answer } = {}) {
  const hit = typeof answer === 'string' && /\b4\b/.test(answer.trim());
  if (hit) {
    return {
      node_id,
      mastery: 'mastered',
      score: 0.9,
      evidence: '用户正确化简并求出极限，说明已理解取极限的过程',
      suggested_state: 'green',
    };
  }
  return {
    node_id,
    mastery: 'partial',
    score: 0.4,
    evidence: '答案不正确，尚未能独立完成化简与取极限',
    suggested_state: 'orange',
  };
}

export function mockTeachingExplain({ content, attempt = 1 } = {}) {
  const intros = [
    '先不管术语，把它想成一个日常的“逐渐靠近”过程。',
    '我们再慢一点：先只看输入怎么变化，再观察输出怎么跟着变化。',
    '最后只记最小的一步：看变化最终靠近什么结果。',
  ];
  return {
    explanation_markdown: `${intros[Math.min(2, Math.max(0, Number(attempt) - 1))]}\n\n${content}\n\n你不需要一次全部记住，先理解其中一个动作即可。`,
  };
}
