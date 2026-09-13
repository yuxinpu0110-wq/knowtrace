// 2号模块适配：严格按 Markdown H1-H4 的直接父子层级生成知识图谱。
//
// 交付版改动：原实现是「写临时文件 → spawn python mock_generate_graph.py → 读回 JSON」，
// 交付包要求「不装 Python 也能双击即跑」，故改为纯 JS（./md2graph.js）。
// 该移植已用 backend/scripts/parity-md2graph.mjs 对拍：57 组输入（含 4 份真实教材
// 与 50+ 边界用例）与 Python 参考实现归一化后逐字节一致。
// 顺带收益：建图从跨进程 + 磁盘 IO（1~3 秒，Windows 上有杀软/编码风险）变成 <10ms 的内存计算。
import { buildGraph } from './md2graph.js';

export async function generateGraph(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) throw new Error('缺少教材 markdown');
  const graph = buildGraph(markdown);
  if (!graph.nodes || !Array.isArray(graph.edges)) throw new Error('2号输出缺少 nodes/edges');
  return graph;
}
