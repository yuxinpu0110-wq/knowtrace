import { useEffect, useState } from 'react';
import MathMarkdown from '../components/MathMarkdown';
import type { Flow } from '../flow/useFlow';
import { nameOf } from './shared';

const STEP_LABELS = ['概念', '直觉', '联系', '示例', '易错点', '检测'];

export function LearnView({ flow }: { flow: Flow }) {
  const { state, actions } = flow;
  const [answer, setAnswer] = useState('');
  const [step, setStep] = useState(0);
  const t = state.teaching;
  const nodeName = nameOf(state.graph, state.teachingNodeId);
  const isDone = state.teachingNodeId != null && state.lastLearnedId === state.teachingNodeId;

  useEffect(() => {
    setStep(0);
    setAnswer('');
  }, [state.teachingNodeId]);

  useEffect(() => {
    actions.setLearningProgress(Math.min(0.82, step / 5 * 0.82));
  }, [step, actions.setLearningProgress]);

  if (isDone) {
    return (
      <div className="ask-view learning-complete">
        <span className="success-mark" aria-hidden="true">✓</span>
        <div>
          <span className="eyebrow">学习完成</span>
          <h2>你已掌握「{nodeName}」</h2>
        </div>
        <div className="block">
          <p className="hint">这个节点已经在图谱中点亮为绿色。你可以返回图谱，继续探索下一处知识路径。</p>
          <button className="primary" onClick={actions.goHome}>返回知识图谱</button>
        </div>
      </div>
    );
  }

  const lessons = t ? [
    { title: '先建立准确概念', kicker: '01 · 定义', body: t.definition },
    { title: '换一个更直观的视角', kicker: '02 · 直觉', body: t.intuition },
    { title: '把它放回知识链中', kicker: '03 · 联系', body: t.relation },
    { title: '跟着最小示例走一遍', kicker: '04 · 示例', body: t.example },
    { title: '避开最常见的误区', kicker: '05 · 易错点', body: t.pitfall },
  ] : [];
  const atCheck = step === STEP_LABELS.length - 1;
  const evaluationFailed = state.evaluation && state.evaluation.suggested_state !== 'green';
  const verifyOptions = t?.verify_options?.length === 5
    ? t.verify_options
    : ['选项 A', '选项 B', '选项 C', '选项 D', '选项 E'];

  return (
    <div className="ask-view interactive-learn">
      <div className="learning-head">
        <span className="eyebrow">交互学习</span>
        <h2>{nodeName}</h2>
        <p className="hint">每次只聚焦一个要点，完成学习后再进行检测。</p>
      </div>

      <ol className="learning-progress" aria-label="学习进度">
        {STEP_LABELS.map((label, index) => (
          <li key={label} className={index < step ? 'done' : index === step ? 'active' : ''}>
            <span>{index < step ? '✓' : index + 1}</span>
            <small>{label}</small>
          </li>
        ))}
      </ol>

      {state.busy && !t && <p className="muted">正在准备个性化学习内容…</p>}

      {t && !atCheck && (
        <section className="lesson-stage" key={step}>
          <span className="lesson-kicker">{lessons[step].kicker}</span>
          <h3>{lessons[step].title}</h3>
          <div className="lesson-content"><MathMarkdown text={lessons[step].body} /></div>
          {state.teachingExtra && (
            <div className="simpler-explanation" key={state.confusionCount}>
              <span>换一种说法 · 第 {state.confusionCount} 次</span>
              <MathMarkdown text={state.teachingExtra} />
            </div>
          )}
          <div className="lesson-actions">
            {step > 0 && <button className="ghost" onClick={() => { actions.clearSimplerExplanation(); setStep((value) => value - 1); }}>上一步</button>}
            {state.confusionCount < 3 && (
              <button
                className="ghost not-understood"
                disabled={state.busy}
                onClick={() => actions.explainSimpler(lessons[step].kicker, state.teachingExtra || lessons[step].body)}
              >
                {state.busy ? '正在换一种说法…' : state.confusionCount > 0 ? '还是没看懂' : '没看懂'}
              </button>
            )}
            {state.confusionCount >= 3 && (
              <button className="ghost danger-soft" onClick={actions.exitLearning}>退出学习</button>
            )}
            <button className="primary" onClick={() => { actions.clearSimplerExplanation(); setStep((value) => Math.min(5, value + 1)); }}>
              {step === 4 ? '我准备好检测了' : '理解了，继续'}
            </button>
          </div>
        </section>
      )}

      {t && atCheck && (
        <section className="lesson-stage verify-stage">
          <span className="lesson-kicker">06 · 最终检测</span>
          <h3>选择唯一正确的答案</h3>
          <div className="question"><MathMarkdown text={t.verify_question} /></div>
          {!evaluationFailed && (
            <div className="verify">
              <div className="verify-options" role="radiogroup" aria-label="检测题选项">
                {verifyOptions.map((option, index) => (
                  <button
                    key={`${option}-${index}`}
                    type="button"
                    role="radio"
                    aria-checked={answer === option}
                    className={`verify-option${answer === option ? ' selected' : ''}`}
                    onClick={() => setAnswer(option)}
                  >
                    <span className="verify-key">{String.fromCharCode(65 + index)}</span>
                    <MathMarkdown text={option} />
                  </button>
                ))}
              </div>
              <div className="lesson-actions">
                <button className="ghost" disabled={state.busy} onClick={() => setStep(4)}>回看易错点</button>
                <button className="primary" disabled={state.busy || !answer.trim()} onClick={() => actions.evaluateAnswer(answer)}>
                  {state.busy ? '评估中…' : '提交检测'}
                </button>
              </div>
            </div>
          )}

          {evaluationFailed && (
            <div className="evaluation-choice" role="status">
              <div className="evaluation-result">
                <span>还差一点</span>
                <MathMarkdown text={state.evaluation!.evidence} />
              </div>
              <p className="hint">你可以重新学习后再检测，也可以暂时退出。退出后该节点会保持橙色薄弱状态。</p>
              <div className="lesson-actions">
                <button
                  className="primary"
                  onClick={() => {
                    actions.retryLearning();
                    setAnswer('');
                    setStep(0);
                  }}
                >
                  继续学习
                </button>
                <button className="ghost" onClick={actions.exitLearning}>退出学习</button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
