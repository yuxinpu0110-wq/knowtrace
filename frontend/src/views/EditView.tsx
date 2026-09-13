import { useState } from 'react';
import type { Flow } from '../flow/useFlow';
import MathMarkdown from '../components/MathMarkdown';

export function EditView({ flow }: { flow: Flow }) {
  const { state, actions } = flow;
  const [addName, setAddName] = useState('');
  const [addChapter, setAddChapter] = useState('');
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState(false);

  const nodes = state.graph?.nodes ?? [];
  const sel = nodes.find((n) => n.id === state.selectedNodeId) ?? null;
  const statusOf = (id: string) => state.masteredIds.includes(id)
    ? 'mastered'
    : state.retainedWeakIds.includes(id) ? 'weak' : 'normal';
  const filtered = filter.trim()
    ? nodes.filter((n) => n.name.includes(filter.trim()) || n.chapter.includes(filter.trim()))
    : nodes;

  return (
    <div className="edit-view">
      <h2>编辑知识图谱</h2>

      <div className="block">
        <div className="field">
          <label htmlFor="graph-name">知识图谱名称</label>
          <input
            id="graph-name"
            type="text"
            maxLength={80}
            value={state.graphName}
            onChange={(event) => actions.setGraphName(event.target.value)}
            placeholder="请输入知识图谱名称"
          />
        </div>
        <h3>导入教材生成图谱</h3>
        <p className="hint">
          使用 `#` 到 `####` 表示最多四层知识点。每个标题都是节点，标题层级就是母知识点与子知识点的关系。
        </p>
        <textarea
          rows={8}
          placeholder="在此粘贴教材 Markdown…"
          value={state.textbook}
          onChange={(e) => actions.setTextbook(e.target.value)}
        />
        <div className="row">
          <button className="primary" disabled={state.busy} onClick={() => actions.generateGraph()}>
            {state.busy ? '正在解析层级…' : '生成图谱'}
          </button>
          <button className="ghost" onClick={() => actions.loadSampleTextbook()}>加载示例教材</button>
        </div>
      </div>

      {state.graph && (
        <>
          <div className="block">
            <h3>节点管理（{nodes.length}）</h3>
            <input
              type="text"
              placeholder="搜索节点名称/章节…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="node-list">
              {filtered.map((n) => (
                <div
                  key={n.id}
                  className={'node-row' + (sel?.id === n.id ? ' active' : '')}
                  onClick={() => actions.selectNode(n.id)}
                >
                  <div>
                    <div className="nm">
                      <MathMarkdown text={n.name} /> {statusOf(n.id) === 'mastered' ? '✓' : statusOf(n.id) === 'weak' ? '●' : ''}
                    </div>
                    <div className="mt">{n.chapter} · 层级 {n.level}</div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <p className="muted">无匹配节点</p>}
            </div>
            <div className="row">
              <button className="ghost" onClick={() => setAdding((v) => !v)}>
                {adding ? '收起' : '+ 添加节点'}
              </button>
            </div>
            {adding && (
              <div className="node-editor">
                <input
                  type="text"
                  placeholder="知识点名称"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="所属章节"
                  value={addChapter}
                  onChange={(e) => setAddChapter(e.target.value)}
                />
                <div className="row">
                  <button
                    className="primary"
                    onClick={() => {
                      actions.addNode({ name: addName, chapter: addChapter });
                      setAddName('');
                      setAddChapter('');
                    }}
                  >
                    添加
                  </button>
                </div>
              </div>
            )}
          </div>

          {sel && (
            <div className="block">
              <h3>选中节点：<MathMarkdown text={sel.name} /></h3>
              <p className="muted">
                <MathMarkdown text={sel.chapter} /> · <MathMarkdown text={sel.summary} />
              </p>
              <div className="node-actions">
                <button
                  className={statusOf(sel.id) === 'normal' ? 'primary' : 'ghost'}
                  onClick={() => actions.setNodeStatus(sel.id, 'normal')}
                >
                  普通
                </button>
                <button
                  className={statusOf(sel.id) === 'weak' ? 'status-weak active' : 'ghost'}
                  onClick={() => actions.setNodeStatus(sel.id, 'weak')}
                >
                  薄弱
                </button>
                <button
                  className={statusOf(sel.id) === 'mastered' ? 'status-mastered active' : 'ghost'}
                  onClick={() => actions.setNodeStatus(sel.id, 'mastered')}
                >
                  已掌握
                </button>
                <button className="danger" onClick={() => actions.removeNode(sel.id)}>
                  删除节点
                </button>
              </div>
            </div>
          )}
        </>
      )}
      <div className="edit-save-bar">
        <button className="primary" onClick={actions.saveGraphEdits}>保存</button>
      </div>
    </div>
  );
}
