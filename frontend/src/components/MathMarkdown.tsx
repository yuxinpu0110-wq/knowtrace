// 轻量 Markdown + LaTeX 渲染：先把 $...$ / $$...$$ 抽出来用 KaTeX 渲染，
// 其余文本做极简 Markdown（**粗体**、*斜体*、`行内代码`、换行）。
// 仅用于展示后端/用户输入内容，不做 XSS 敏感场景。
import { useMemo, type ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

type Seg =
  | { kind: 'math'; tex: string; display: boolean }
  | { kind: 'text'; text: string };

function tokenize(text: string): Seg[] {
  const segs: Seg[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([^\n]+?)\\\)|\$([^$\n]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) segs.push({ kind: 'text', text: text.slice(last, m.index) });
    const display = m[1] !== undefined || m[2] !== undefined;
    segs.push({ kind: 'math', tex: (m[1] ?? m[2] ?? m[3] ?? m[4]).trim(), display });
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ kind: 'text', text: text.slice(last) });
  return segs;
}

function renderMath(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, { throwOnError: false, displayMode: display });
  } catch {
    return tex;
  }
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const lines = text.split('\n');
  lines.forEach((line, li) => {
    if (li > 0) out.push(<br key={`${keyPrefix}-br${li}`} />);
    const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(line))) {
      if (m.index > last) out.push(line.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith('**')) out.push(<strong key={`${keyPrefix}-b${li}-${i}`}>{tok.slice(2, -2)}</strong>);
      else if (tok.startsWith('`')) out.push(<code key={`${keyPrefix}-c${li}-${i}`}>{tok.slice(1, -1)}</code>);
      else out.push(<em key={`${keyPrefix}-i${li}-${i}`}>{tok.slice(1, -1)}</em>);
      last = m.index + tok.length;
      i++;
    }
    if (last < line.length) out.push(line.slice(last));
  });
  return out;
}

export default function MathMarkdown({ text }: { text?: string | null }) {
  const content = text ?? '';
  const nodes = useMemo(() => {
    if (!content) return null;
    return tokenize(content).map((s, i) => {
      if (s.kind === 'math') {
        return (
          <span
            key={i}
            className={s.display ? 'mm-display' : 'mm-inline'}
            dangerouslySetInnerHTML={{ __html: renderMath(s.tex, s.display) }}
          />
        );
      }
      return <span key={i}>{renderInline(s.text, `mm${i}`)}</span>;
    });
  }, [content]);

  if (!content) return null;
  return <span className="math-md">{nodes}</span>;
}
