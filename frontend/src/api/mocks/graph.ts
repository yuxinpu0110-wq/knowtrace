import type { GraphData } from '../../types';
import { loadGraph } from './shared';

export async function mockGenerateGraph(): Promise<{ graph: GraphData }> {
  return { graph: await loadGraph() };
}
