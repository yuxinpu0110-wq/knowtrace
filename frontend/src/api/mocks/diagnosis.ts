import type { Diagnosis, GraphData, SeedNode } from '../../types';
import { nodeByName, scenarioForGraph } from './scenarios';

export function mockDiagnosisNext(
  round = 0,
  question = '题目',
  seedNodes: SeedNode[] = [],
  graph?: GraphData | null,
): Diagnosis {
  const scenario = scenarioForGraph(graph);
  if (!scenario || !graph) {
    const seed = seedNodes[0];
    return {
      question,
      seed_nodes: seedNodes,
      suspected_gap: seed ? { node_id: seed.node_id, confidence: 0.72, reason: '内置演示诊断定位到当前相关知识点' } : undefined,
      weak_points: seed ? [{ node_id: seed.node_id, confidence: 0.72 }] : [],
      activated_nodes: seed ? [{ node_id: seed.node_id, distance: 0, brightness: 0.72, state: 'suspected_gap' }] : [],
      next_question: null,
      next_options: null,
      done: true,
    };
  }

  const seed = nodeByName(graph, scenario.seedName) ?? graph.nodes.find((node) => node.id === seedNodes[0]?.node_id);
  const weak = nodeByName(graph, scenario.weakName) ?? seed;
  const secondary = nodeByName(graph, scenario.secondaryName);
  if (!weak) return { question, seed_nodes: seedNodes, weak_points: [], done: true };

  const step = Math.max(0, Math.floor(round));
  const done = step >= scenario.diagnosis.length;
  const confidence = [0.48, 0.66, 0.82, 0.92][Math.min(step, 3)];
  const weakPoints = [
    { node_id: weak.id, confidence, reason: `诊断逐步聚焦到“${weak.name}”` },
    ...(secondary && secondary.id !== weak.id ? [{ node_id: secondary.id, confidence: Math.max(0.28, confidence - 0.24) }] : []),
  ];

  return {
    question,
    seed_nodes: seed ? [{ node_id: seed.id, relevance: 0.94, reason: `题目直接涉及“${seed.name}”` }] : seedNodes,
    suspected_gap: weakPoints[0],
    weak_points: weakPoints,
    activated_nodes: [
      ...(seed ? [{ node_id: seed.id, distance: 0, brightness: 0.94, state: 'question_related' as const }] : []),
      { node_id: weak.id, distance: 1, brightness: confidence, state: 'suspected_gap' as const },
      ...(secondary ? [{ node_id: secondary.id, distance: 1, brightness: Math.max(0.28, confidence - 0.24), state: 'suspected_gap' as const }] : []),
    ],
    next_question: done ? null : scenario.diagnosis[step].question,
    next_options: done ? null : scenario.diagnosis[step].options,
    done,
  };
}
