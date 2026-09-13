import { useState } from 'react';
import MathMarkdown from '../components/MathMarkdown';
import type { Flow } from '../flow/useFlow';
import { nameOf } from './shared';

export function TestView({ flow }: { flow: Flow }) {
  const { state, actions } = flow;
  const [freeText, setFreeText] = useState('');
  const gap = state.diagnosis?.suspected_gap;
  const weakPoints = state.diagnosis?.weak_points ?? [];

  return (
    <div className="ask-view">
      <h2>诊断</h2>

      {!state.diagnosisDone ? (
        <div className="block">
          <h3>第 {state.diagnosisRound + 1} 轮 · 前置知识自查</h3>
          {state.busy && !state.currentQuestion ? (
            <p className="muted">正在加载诊断题目…</p>
          ) : (
            <>
              {state.currentQuestion && (
                <div className="question">
                  <MathMarkdown text={state.currentQuestion} />
                </div>
              )}

              {state.currentOptions ? (
                <>
                  <div className="options">
                    {state.currentOptions.map((o, i) => (
                      <button
                        key={i}
                        className="opt-btn"
                        disabled={state.busy}
                        onClick={() => actions.answerDiagnosis(o.text, o.signal)}
                      >
                        <span className="opt-key">{String.fromCharCode(65 + i)}</span>
                        <span className="opt-text">
                          <MathMarkdown text={o.text} />
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="row">
                    <button className="ghost" disabled={state.busy} onClick={() => actions.answerDiagnosis('模糊', 'fuzzy')}>
                      模糊
                    </button>
                    <button className="ghost" disabled={state.busy} onClick={() => actions.answerDiagnosis('不会', 'dontknow')}>
                      不会
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <textarea
                    rows={3}
                    placeholder="简述你的理解…"
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                  />
                  <button
                    className="primary"
                    disabled={state.busy || !freeText.trim()}
                    onClick={() => {
                      actions.answerDiagnosis(freeText);
                      setFreeText('');
                    }}
                  >
                    提交回答
                  </button>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="block">
          <h3>诊断完成</h3>
          {gap ? (
            <div className="gap-card">
              <p>
                <strong>疑似薄弱点</strong>：{nameOf(state.graph, gap.node_id)}
              </p>
              <p className="muted">置信度 {Math.round(gap.confidence * 100)}%</p>
            </div>
          ) : (
            <p className="muted">未发现明显薄弱点。</p>
          )}
          {weakPoints.length > 1 && (
            <div className="weak-list">
              <p className="muted">其它较低置信度的薄弱点：</p>
              <div className="row">
                {weakPoints.slice(1).map((w) => (
                  <span key={w.node_id} className="weak-chip">
                    {nameOf(state.graph, w.node_id)} · {Math.round(w.confidence * 100)}%
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="hint">
            在左侧图谱上<b>点击你想学习的节点</b>开始学习（橙色为疑似薄弱点，亮度越高越薄弱，仅作提示，由你决定学哪个）。
          </p>
        </div>
      )}
    </div>
  );
}
