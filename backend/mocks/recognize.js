// 3号 识别 Mock（OCR 缺失，文字兜底）。
export function mockRecognize({ text } = {}) {
  const canned = {
    problem_markdown: '求函数 $f(x)=x^2$ 在 $x=1$ 处的导数。',
    subject: '高等数学',
    image_quality: 'good',
    confidence: 0.93,
    uncertain_spans: [{ text: 'x=1', reason: '手写字符可能识别为 x=l' }],
  };
  if (typeof text === 'string' && text.trim()) {
    return { ...canned, problem_markdown: text.trim(), uncertain_spans: [] };
  }
  return canned;
}
