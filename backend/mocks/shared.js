// 各环节 Mock 共用的图谱加载（从 contracts 金标读取）。
import { readFileSync } from 'node:fs';

let graph = null;
export function loadGraph() {
  if (!graph) {
    graph = JSON.parse(readFileSync(new URL('../../contracts/graph.example.json', import.meta.url), 'utf8'));
  }
  return graph;
}
