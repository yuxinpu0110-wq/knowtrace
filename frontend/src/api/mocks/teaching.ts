import type { Evaluation, Teaching, TeachingExplanation } from '../../types';
import type { GraphData } from '../../types';
import { loadGraph } from './shared';
import { nodeByName, scenarioForGraph } from './scenarios';

const TEACHING: Record<string, Teaching> = {
  limit_definition: {
    node_id: 'limit_definition',
    definition: '极限描述当 $x$ 趋近某一点时，函数值 $f(x)$ 的变化趋势。',
    intuition: '把 $x$ 一步步靠近目标点，观察 $f(x)$ 越来越接近哪个常数，而不是直接代入。',
    relation: '求导时差商需要取 $h \\to 0$ 的极限，这正是极限概念的直接应用。',
    example: '$$\\lim_{x \\to 1}\\frac{x^2-1}{x-1}=\\lim_{x \\to 1}(x+1)=2.$$ ',
    pitfall: '不能直接令 $h=0$；要先化简并约去公因子，再取极限。',
    verify_question: '计算 $$\\lim_{x \\to 2}\\frac{x^2-4}{x-2}.$$ ',
    verify_options: ['$2$', '$3$', '$4$', '$6$', '$8$'],
  },
};

export async function mockTeachingGenerate(nodeId: string, currentGraph?: GraphData | null): Promise<Teaching> {
  const scenario = scenarioForGraph(currentGraph);
  const scenarioNode = scenario ? nodeByName(currentGraph, scenario.weakName) : undefined;
  if (scenario && scenarioNode?.id === nodeId) return { node_id: nodeId, ...scenario.teaching };
  const t = TEACHING[nodeId];
  if (t) return t;
  const graph = currentGraph ?? await loadGraph();
  const node = graph.nodes.find((n) => n.id === nodeId);
  return {
    node_id: nodeId,
    definition: node?.summary ?? '（通用定义占位）',
    intuition: '从直觉上理解该概念，并把它与题目联系起来。',
    relation: '该概念是当前题目某一步的前置知识。',
    example: '（示例占位，正式接入 6号后由教材证据生成）',
    pitfall: '常见误区：跳过关键步骤直接套结论。',
    verify_question: '（验证题占位）',
    verify_options: ['A', 'B', 'C', 'D', 'E'],
  };
}

export function mockEvaluate(nodeId: string, answer: string, graph?: GraphData | null): Evaluation {
  const scenario = scenarioForGraph(graph);
  const scenarioNode = scenario ? nodeByName(graph, scenario.weakName) : undefined;
  const normalized = (value: string) => value.replace(/[\s$]/g, '');
  const hit = scenario && scenarioNode?.id === nodeId
    ? normalized(answer ?? '') === normalized(scenario.correctAnswer)
    : /\b4\b/.test(answer?.trim() ?? '');
  const evidence = scenario && scenarioNode?.id === nodeId
    ? scenario.successEvidence
    : '用户正确化简并求出极限，说明已理解取极限的过程';
  const failureEvidence = scenario && scenarioNode?.id === nodeId
    ? `尚未正确应用“${scenario.weakName}”的核心判断，建议继续学习后再试。`
    : '答案不正确，尚未能独立完成化简与取极限';
  return hit
    ? { node_id: nodeId, mastery: 'mastered', score: 0.9, evidence, suggested_state: 'green' }
    : { node_id: nodeId, mastery: 'partial', score: 0.4, evidence: failureEvidence, suggested_state: 'orange' };
}

export function mockTeachingExplain(section: string, content: string, attempt: number): TeachingExplanation {
  const prefixes = [
    '换成一句大白话：',
    '我们再慢一点，把它想成一个日常动作：',
    '最后只抓住最小的一步：',
  ];
  return {
    explanation_markdown: `${prefixes[Math.min(2, Math.max(0, attempt - 1))]}\n\n${content}\n\n先不用记完整定义，只说说你能理解其中哪一个词或哪一步。`,
  };
}
