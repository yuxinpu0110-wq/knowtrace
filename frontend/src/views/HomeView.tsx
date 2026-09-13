import NodeCard from '../components/NodeCard';
import type { Flow } from '../flow/useFlow';

export function HomeView({ flow }: { flow: Flow }) {
  const { state, actions, stateMap } = flow;
  const sel = state.graph?.nodes.find((n) => n.id === state.selectedNodeId) ?? null;

  return (
    <div className="home-view">
      <div className="view-intro">
        <span className="eyebrow">学习空间</span>
        <h2>从问题出发，找到知识断点。</h2>
        <p className="hint">提出一道让你卡住的问题，知溯会沿知识图谱向前追踪，帮你定位真正需要补齐的基础。</p>
      </div>
      {state.graph && (
        <div className="stats" aria-label="图谱概览">
          <span><strong>{state.graph.nodes.length}</strong> 个知识点</span>
          <span className="green"><strong>{state.masteredIds.length}</strong> 个已掌握</span>
        </div>
      )}
      <div className="home-btns">
        <button className="primary home-primary" onClick={actions.goProblem}>
          <span>提出问题</span><span aria-hidden="true">→</span>
        </button>
        <button
          className={`ghost home-secondary${state.directLearn ? ' active' : ''}`}
          disabled={!state.graph}
          onClick={actions.goDirectLearn}
        >
          <span>直接学习</span><span aria-hidden="true">▶</span>
        </button>
        <button className="ghost home-secondary" onClick={actions.goGraphManager}>
          <span>当前知识图谱：{state.graphName}</span><span aria-hidden="true">↗</span>
        </button>
      </div>
      {state.directLearn && (
        <div className="direct-learn-hint" role="status">
          <div className="direct-learn-head">
            <span className="eyebrow">直接学习</span>
            <button className="ghost" onClick={actions.goHome}>退出</button>
          </div>
          <p>在左侧图谱上<b>点击你想学习的知识点</b>，知溯会直接开始这个节点的教学与检测，无需提问和诊断。</p>
          <p className="muted">橙色为疑似薄弱点，亮度越高越薄弱，仅作提示，由你决定学哪个。</p>
        </div>
      )}
      {sel && <NodeCard node={sel} state={stateMap.get(sel.id) ?? 'inactive'} />}
    </div>
  );
}
