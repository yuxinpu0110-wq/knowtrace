import type { DirectAnswer, GraphData, SeedNode } from '../../types';
import { scenarioForGraph } from './scenarios';

export function mockAnswerQuestion(question: string, graph: GraphData | null, seedNodes: SeedNode[]): DirectAnswer {
  const scenario = scenarioForGraph(graph);
  if (scenario) {
    return {
      answer_markdown: scenario.directAnswer,
      confidence: 0.96,
      source_node_ids: seedNodes.map((seed) => seed.node_id),
    };
  }
  const related = seedNodes
    .map((seed) => graph?.nodes.find((node) => node.id === seed.node_id))
    .filter(Boolean);
  const context = related.map((node) => `「${node!.name}」：${node!.summary}`).join('；');
  const point = question.match(/x\s*=\s*(-?\d+(?:\.\d+)?)/i)?.[1];
  let answer: string;
  if (/sin\s*x|正弦/i.test(question)) {
    answer = point === undefined
      ? '正弦函数的导数为 $$\\frac{d}{dx}\\sin x=\\cos x.$$'
      : `正弦函数的导数为 $\\cos x$，因此在 $x=${point}$ 处，$$f'(${point})=\\cos(${point})\\approx ${Math.cos(Number(point)).toFixed(4)}.$$（弧度制）`;
  } else if (/cos\s*x|余弦/i.test(question)) {
    answer = '余弦函数的导数为 $$\\frac{d}{dx}\\cos x=-\\sin x.$$';
  } else {
    answer = `根据当前教材中与问题最相关的内容：${context || '暂未找到足够的上下文'}。\n\n建议先明确已知条件和目标，再沿相关知识点逐步推导。你也可以开始诊断，进一步定位缺失的前置知识。`;
  }
  return {
    answer_markdown: answer,
    confidence: /sin|cos|正弦|余弦/i.test(question) ? 0.96 : 0.62,
    source_node_ids: seedNodes.map((seed) => seed.node_id),
  };
}
