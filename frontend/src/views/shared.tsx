import type { ReactNode } from 'react';
import type { GraphData } from '../types';
import { latexToText } from '../graph/latexToText';

// 节点 id -> 展示名（找不到时兜底返回 id）。
export function nameOf(graph: GraphData | null, id: string | null): string {
  if (!id) return '';
  const n = graph?.nodes.find((x) => x.id === id);
  return n ? `${latexToText(n.name)}（${latexToText(n.chapter)}）` : id;
}

export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="block">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
