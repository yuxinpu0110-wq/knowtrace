import type { Flow } from '../flow/useFlow';

export function GraphManagerView({ flow }: { flow: Flow }) {
  const { state, graphs, actions } = flow;

  const remove = () => {
    if (graphs.length <= 1) return;
    if (window.confirm(`确定删除“${state.graphName}”吗？此操作无法撤销。`)) actions.deleteActiveGraph();
  };

  return (
    <div className="graph-manager-view">
      <div className="view-intro">
        <span className="eyebrow">知识空间</span>
        <h2>管理知识图谱</h2>
        <p className="hint">选择一张图谱进入学习；点击右侧省略号编辑名称、教材、节点和掌握状态。</p>
      </div>

      <div className="graph-library" role="list">
        {graphs.map((item, index) => (
          <div
            role="listitem"
            tabIndex={0}
            key={item.id}
            className={`graph-library-row${item.id === state.activeGraphId ? ' active' : ''}`}
            style={{ animationDelay: `${index * 45}ms` }}
            onClick={() => actions.switchGraph(item.id, '/graphs')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                actions.switchGraph(item.id, '/graphs');
              }
            }}
          >
            <span className="graph-library-index">{String(index + 1).padStart(2, '0')}</span>
            <span className="graph-library-main">
              <strong>{item.name}</strong>
              <small>{item.graph ? `${item.graph.nodes.length} 个知识点` : '尚未生成图谱'}</small>
            </span>
            {item.id === state.activeGraphId && <span className="current-graph-mark">当前</span>}
            <button
              type="button"
              className="graph-more"
              title={`编辑 ${item.name}`}
              onClick={(event) => {
                event.stopPropagation();
                actions.switchGraph(item.id, '/edit');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  actions.switchGraph(item.id, '/edit');
                }
              }}
            >•••</button>
          </div>
        ))}
      </div>

      <div className="graph-library-actions" aria-label="增删知识图谱">
        <button className="round-action" title="新增知识图谱" onClick={actions.addGraph}>＋</button>
        <button className="round-action danger" title="删除当前知识图谱" disabled={graphs.length <= 1} onClick={remove}>−</button>
      </div>
    </div>
  );
}
