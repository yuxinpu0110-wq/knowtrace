import MathMarkdown from '../components/MathMarkdown';
import type { Flow } from '../flow/useFlow';

export function ProblemView({ flow }: { flow: Flow }) {
  const { state, actions } = flow;

  return (
    <div className="ask-view">
      <h2>提问</h2>
      <div className="block">
        <h3>输入你的问题</h3>
        <p className="hint">
          支持 Markdown 与 LaTeX（`$...$` / `$$...$$`），也允许直接输入自然语言，系统会自动识别。
        </p>
        <textarea
          rows={6}
          placeholder={'例如：求 $f(x)=x^2$ 在 $x=1$ 处的导数。\n\n或直接用自然语言描述你卡在哪一步…'}
          value={state.questionText}
          onChange={(e) => actions.setQuestionText(e.target.value)}
        />
        {state.questionText.trim() && (
          <div className="preview-block">
            <div className="preview-label">识别预览（Markdown 自动识别）</div>
            <MathMarkdown text={state.questionText} />
          </div>
        )}
        <button
          className="primary"
          disabled={state.busy || !state.questionText.trim()}
          onClick={() => actions.submitQuestion()}
        >
          {state.busy ? '正在分析并生成解答…' : '获取解答'}
        </button>
      </div>

      {state.coverageIssue && (
        <div className="coverage-card" role="status">
          <span className="coverage-icon" aria-hidden="true">!</span>
          <div>
            <h3>当前知识库暂时无法解答</h3>
            <p>{state.coverageIssue}</p>
            <p className="muted">你可以换一个与当前教材相关的问题，或前往「编辑」补充教材内容后重新生成图谱。</p>
          </div>
        </div>
      )}

      {state.directAnswer && (
        <section className="answer-card">
          <div className="answer-card-head">
            <div>
              <span className="eyebrow">直接解答</span>
              <h3>先解决眼前的问题</h3>
            </div>
            <span className="answer-confidence">{Math.round(state.directAnswer.confidence * 100)}% 可信</span>
          </div>
          <div className="answer-content"><MathMarkdown text={state.directAnswer.answer_markdown} /></div>
          <div className="answer-next">
            <div>
              <strong>想知道为什么会卡住？</strong>
              <p className="muted">通过几轮前置知识自查，找到真正需要补齐的节点。</p>
            </div>
            <button className="primary" disabled={state.busy} onClick={actions.startDiagnosis}>开始诊断 →</button>
          </div>
        </section>
      )}
    </div>
  );
}
