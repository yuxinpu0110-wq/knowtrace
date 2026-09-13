import type { RecognizedQuestion } from '../../types';

function inferSubject(text: string) {
  if (/军事|战争|国防|信息化/.test(text)) return '军事理论';
  if (/矩阵|线性|方程组|高斯|向量|行列式/.test(text)) return '线性代数';
  return '微积分';
}

export function mockRecognize(text?: string): RecognizedQuestion {
  const problem = text?.trim() || '求函数 $f(x)=x^2$ 在 $x=1$ 处的导数。';
  return {
    problem_markdown: problem,
    subject: inferSubject(problem),
    image_quality: 'good',
    confidence: 0.93,
    uncertain_spans: [],
  };
}
