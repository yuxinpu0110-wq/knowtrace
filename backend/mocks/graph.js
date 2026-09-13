// 2号 建图 Mock。
import { loadGraph } from './shared.js';

export function mockGraphGenerate() {
  return { graph: loadGraph() };
}
