const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
  theta: 'θ', vartheta: 'ϑ', lambda: 'λ', mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ',
  tau: 'τ', phi: 'φ', varphi: 'ϕ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ',
  Lambda: 'Λ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Omega: 'Ω',
  infty: '∞', partial: '∂', nabla: '∇', sum: '∑', prod: '∏', int: '∫', oint: '∮',
  to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔', implies: '⇒',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', equiv: '≡',
  times: '×', cdot: '·', pm: '±', mp: '∓', div: '÷', in: '∈', notin: '∉',
  subset: '⊂', subseteq: '⊆', cup: '∪', cap: '∩', forall: '∀', exists: '∃',
  sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', sec: 'sec', csc: 'csc',
  ln: 'ln', log: 'log', exp: 'exp', lim: 'lim', max: 'max', min: 'min',
};

const SUPER: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ', x: 'ˣ',
};
const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ',
  k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
};

function scripted(value: string, table: Record<string, string>, marker: '^' | '_') {
  const converted = [...value].map((char) => table[char]).join('');
  return converted.length === value.length ? converted : `${marker}(${value})`;
}

/** 将 Canvas/纯文本环境无法排版的 LaTeX 转成易读数学字符；不修改原始数据。 */
export function latexToText(input?: string | null): string {
  let text = String(input ?? '');
  text = text.replace(/\$\$?|\$\$/g, '').replace(/\\\(|\\\)|\\\[|\\\]/g, '');
  text = text.replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\{([^{}]*)\}/g, '$1');
  for (let pass = 0; pass < 3; pass++) {
    text = text.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)⁄($2)');
    text = text.replace(/\\sqrt(?:\[([^\]]+)\])?\{([^{}]+)\}/g, (_, root, body) => root ? `√[$${root}](${body})`.replace('$', '') : `√(${body})`);
  }
  text = text.replace(/\\(left|right|displaystyle|textstyle)\b/g, '');
  text = text.replace(/\\([A-Za-z]+)/g, (_, command) => SYMBOLS[command] ?? command);
  text = text.replace(/\^\{([^{}]+)\}/g, (_, value) => scripted(value, SUPER, '^'));
  text = text.replace(/_\{([^{}]+)\}/g, (_, value) => scripted(value, SUB, '_'));
  text = text.replace(/\^([A-Za-z0-9+\-=])/g, (_, value) => scripted(value, SUPER, '^'));
  text = text.replace(/_([A-Za-z0-9+\-=])/g, (_, value) => scripted(value, SUB, '_'));
  text = text.replace(/[{}]/g, '').replace(/\\[,;:! ]/g, ' ').replace(/\\/g, '');
  return text.replace(/\s+/g, ' ').trim();
}
