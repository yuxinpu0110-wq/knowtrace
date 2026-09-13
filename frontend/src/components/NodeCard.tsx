import type { GraphNode, NodeState } from '../types';
import { STATE_COLORS, STATE_LABELS } from '../graph/lighting';
import MathMarkdown from './MathMarkdown';

export default function NodeCard({ node, state }: { node: GraphNode; state: NodeState }) {
  return (
    <div className="node-card">
      <div className="node-card-head">
        <strong><MathMarkdown text={node.name} /></strong>
        <span className="badge" style={{ background: STATE_COLORS[state] }}>
          {STATE_LABELS[state]}
        </span>
      </div>
      <div className="node-card-meta">
        <MathMarkdown text={node.chapter} /> · 层级 {node.level}
      </div>
      <p className="node-card-summary"><MathMarkdown text={node.summary} /></p>
    </div>
  );
}
