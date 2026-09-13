import type { GraphData } from '../../types';
// 直接内联示例图谱，而不是 fetch('/graph.example.json')：
// 单文件版是从 file:// 打开的，那里 fetch 本地文件会被 CORS 拦掉。
// 内联后无论从 file:// 还是从后端托管，行为一致。
import graphExample from '../../assets/graph.example.json';

let cachedGraph: GraphData | null = null;

export async function loadGraph(): Promise<GraphData> {
  if (cachedGraph) return cachedGraph;
  cachedGraph = graphExample as unknown as GraphData;
  return cachedGraph;
}
