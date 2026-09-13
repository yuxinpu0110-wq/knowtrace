import type { GraphData } from '../types';

// 默认只传播 3 跳（AGENTS.md 第 8 节）
export const MAX_HOPS = 3;

// 边的端点可能是 id 字符串，也可能已被 force-graph / d3-force 原地替换成节点对象
// （react-force-graph 会改写传入的 link 对象），两种形式都要能取到 id，否则邻接表会全空。
function endId(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'object') return (v as { id?: string }).id;
  return v as string;
}

// 邻接表：无向图（前置/后续双向都能激活，便于回溯前置断点）。
// 跳过引用不存在节点或自环的边，避免非法数据拖垮 BFS。
export function buildAdjacency(graph: GraphData): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const n of graph.nodes) adj.set(n.id, []);
  for (const e of graph.edges) {
    const s = endId(e.source);
    const t = endId(e.target);
    if (!s || !t || s === t) continue;
    if (!adj.has(s) || !adj.has(t)) continue;
    adj.get(s)!.push(t);
    adj.get(t)!.push(s);
  }
  return adj;
}

// 本地 BFS：从 seedId 出发计算到各节点的最短距离（跳数）。
// 只返回可达且距离 <= MAX_HOPS 的节点；其余节点不在 Map 中（视为未激活）。
// 未知 seedId 返回空 Map。
export function bfsDistance(graph: GraphData, seedId: string): Map<string, number> {
  const adj = buildAdjacency(graph);
  const dist = new Map<string, number>();
  if (!adj.has(seedId)) return dist;

  const queue: string[] = [seedId];
  dist.set(seedId, 0);
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const nd = dist.get(cur)!;
    if (nd >= MAX_HOPS) continue; // 不再向下传播
    for (const nb of adj.get(cur)!) {
      if (!dist.has(nb)) {
        dist.set(nb, nd + 1);
        queue.push(nb);
      }
    }
  }
  return dist;
}
