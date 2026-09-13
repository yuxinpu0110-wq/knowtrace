// 6号模块适配：单节点教学 + 验证题评估。
// 移植 6号的「教材化教学」结构，字段映射到 7号冻结契约：
//   6号 lesson.relation_to_problem -> relation
//   6号 lesson.minimal_example   -> example
//   6号 lesson.common_pitfall    -> pitfall
//   6号 lesson.verification_question -> verify_question
// 教学库扩充覆盖图谱主要节点（尤其诊断可能命中的前置断点），验证题采用数值/表达式答案，适配前端输入框。
import { getGraph } from './state.js';
import { chatJson, hasKey } from './deepseek.js';

// 数值答案 => 与 6号 verification.expected_answer 对齐；表达式用于“是/否”类概念题。
const TEACHINGS = {
  limit_definition: {
    node_id: 'limit_definition',
    definition: '极限 $$\\lim_{x \\to x_0} f(x)=A$$ 表示当 $x$ 无限趋近 $x_0$ 时，$f(x)$ 无限趋近 $A$。',
    intuition: '把 $f$ 想象成一台机器：输入 $x$ 越靠近 $x_0$，输出 $f(x)$ 就越靠近 $A$。',
    relation: '求导时，差商需要取 $h \\to 0$ 的极限；这正是极限概念的直接应用。',
    example: '$$\\lim_{x \\to 1}\\frac{x^2-1}{x-1}=\\lim_{x \\to 1}(x+1)=2.$$ ',
    pitfall: '不能直接令 $h=0$ 代入差商；需要先化简并约去公因子，再取极限。',
    verify_question: '计算 $$\\lim_{x \\to 2}\\frac{x^2-4}{x-2}.$$ ',
    expected_answer: { kind: 'numeric', value: 4, tolerance: 1e-6 },
  },
  derivative_definition: {
    node_id: 'derivative_definition',
    definition: '导数 $$f\'(x_0)=\\lim_{h \\to 0}\\frac{f(x_0+h)-f(x_0)}{h}$$ 是函数在一点的瞬时变化率。',
    intuition: '先观察平均变化率，再让间隔 $h \\to 0$，得到的就是瞬时变化率。',
    relation: '求一点处的导数，本质是对差商取极限；关键步骤是令 $h \\to 0$。',
    example: '当 $f(x)=x^2$、$x_0=1$ 时：$$\\frac{(1+h)^2-1}{h}=2+h \\to 2,$$ 因此 $f\'(1)=2$。',
    pitfall: '导数不是某个固定区间上的平均变化率；必须令 $h \\to 0$ 取极限。',
    verify_question: '计算 $f(x)=x^2$ 在 $x=1$ 处的导数。',
    expected_answer: { kind: 'numeric', value: 2, tolerance: 1e-6 },
  },
  function_definition: {
    node_id: 'function_definition',
    definition: '函数是两个集合间的对应关系：定义域内每个 $x$ 唯一确定一个 $y$。',
    intuition: '把函数看成一台机器：每个输入 $x$ 只对应一个输出 $y$。',
    relation: '理解极限、导数都建立在「函数对应关系」之上，这是最根本的前置概念。',
    example: '$f(x)=x^2$ 是函数；而关系 $y^2=x$ 一般不能表示 $y$ 是 $x$ 的函数。',
    pitfall: '把「任一关系」当函数；判断函数先看唯一性。',
    verify_question: '判断 $y^2=x$ 是否表示 $y$ 是 $x$ 的函数，回答“是”或“否”。',
    expected_answer: { kind: 'expression', value: '否' },
  },
  sequence_limit: {
    node_id: 'sequence_limit',
    definition: '数列 $\\{a_n\\}$ 的极限为 $a$，表示当 $n \\to \\infty$ 时，$a_n$ 无限接近 $a$。',
    intuition: '想象 $n$ 越来越大，数列项 $a_n$ 越来越靠近某个常数。',
    relation: '函数极限由数列极限推广而来，是极限入门的第一步。',
    example: '数列 $a_n=\\frac{1}{n}$ 满足 $$\\lim_{n \\to \\infty}a_n=0.$$ ',
    pitfall: '混淆「极限」与「数列中某一项的值」。',
    verify_question: '求数列 $a_n=\\frac{1}{n}$ 在 $n \\to \\infty$ 时的极限。',
    expected_answer: { kind: 'numeric', value: 0, tolerance: 1e-6 },
  },
  continuity: {
    node_id: 'continuity',
    definition: '$f$ 在 $x_0$ 连续，当且仅当 $$\\lim_{x \\to x_0}f(x)=f(x_0).$$ ',
    intuition: '图像在该点不断开，能一笔画过去。',
    relation: '连续性用极限来定义，是极限概念的直接应用。',
    example: '函数 $f(x)=x^2$ 在其定义域内处处连续。',
    pitfall: '以为「有定义就连续」，还必须极限存在且等于函数值。',
    verify_question: '判断函数 $f(x)=x$ 在任意点是否连续，回答“是”或“否”。',
    expected_answer: { kind: 'expression', value: '是' },
  },
  derivative_rules: {
    node_id: 'derivative_rules',
    definition: '和差可以逐项求导；乘积法则为 $(uv)\'=u\'v+uv\'$；链式法则为 $(f\\circ g)\'=f\'(g)g\'$。',
    intuition: '把复杂函数拆成基本初等函数，再按规则组合求导。',
    relation: '求导法则由导数定义推出，是实际计算的工具。',
    example: '$$\\frac{d}{dx}(x^2)=2x.$$ ',
    pitfall: '乘积导数误写成 u′·v′，漏了交叉项。',
    verify_question: '求 $\\frac{d}{dx}x^2$ 在 $x=3$ 处的值。',
    expected_answer: { kind: 'numeric', value: 6, tolerance: 1e-6 },
  },
  limit_properties: {
    node_id: 'limit_properties',
    definition: '极限存在时，和、差、积的极限等于对应极限的和、差、积；商法则还要求分母极限 $\\ne 0$。',
    intuition: '极限可以拆开分别算，但相除时要注意分母不能趋于 0。',
    relation: '极限运算是求导中「取极限」这一步骤的基础。',
    example: '若各极限存在，则 $$\\lim(x^2+x)=\\lim x^2+\\lim x.$$ ',
    pitfall: '忽略「分母极限≠0」就直接相除。',
    verify_question: '计算 $$\\lim_{x \\to 1}(x+1).$$ ',
    expected_answer: { kind: 'numeric', value: 2, tolerance: 1e-6 },
  },
};

const specCache = new Map();

// 6号教学文案的 DeepSeek Prompt 与辅助函数。
const TEACH_SYSTEM_PROMPT = `你是「教材化教学导师」。针对给定知识点，生成一份用于弥补知识断层的教学材料。

硬规则：
1. 用中文、面向学生、通俗易懂；数学用 LaTeX（$...$ 或 $$...$$）。
2. 所有数学变量、表达式、公式、函数与数值关系都必须使用 LaTeX；行内使用 $...$，独立公式使用 $$...$$，不能输出 x²、→、lim 等裸数学文本。
3. 输出一个 JSON 对象，字段如下：
   - definition：该知识点的一句话定义；
   - intuition：用直觉/类比帮助理解；
   - relation：说明该知识点在知识链中的位置与作用（它是哪些后续概念的基石）；
   - example：一个最小、可验证的示例；
   - pitfall：一个常见误区或易错点；
   - verify_question：一道验证题（学生独立作答，用来检验是否掌握）；
   - expected_answer：验证题的正确答案，形如 {"kind":"numeric","value":<数字>,"tolerance":0.000001} 或 {"kind":"expression","value":"..."}。
4. verify_question 必须能客观判分：能算出数值就用 numeric，否则用 expression（简短、规范化）。
5. 只输出一个 JSON 对象，不要代码块、不要解释。`;

function buildTeachUserPrompt(node) {
  return `知识点名称：${node.name}\n所属章节：${node.chapter || ''}\n摘要：${node.summary || ''}\n关键词：${(node.keywords || []).join('、')}\n\n请为该知识点生成教学材料。`;
}

function pick(v, fallback) {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

function hasBareMath(payload) {
  const fields = ['definition', 'intuition', 'relation', 'example', 'pitfall', 'verify_question'];
  const text = fields.map((field) => String(payload?.[field] || '')).join('\n')
    .replace(/\$\$[\s\S]*?\$\$/g, '')
    .replace(/\$[^$\n]+?\$/g, '');
  return /[→∞≠≤≥²³]|(?:^|\s)lim(?:_|\s|\{)/i.test(text);
}

function normalizeExpected(ea) {
  if (!ea) return null;
  if (ea.kind === 'numeric') {
    const v = Number(ea.value);
    if (Number.isFinite(v)) return { kind: 'numeric', value: v, tolerance: Number(ea.tolerance) || 1e-6 };
    return null;
  }
  if (ea.kind === 'expression' && typeof ea.value === 'string' && ea.value.trim()) {
    return { kind: 'expression', value: ea.value.trim() };
  }
  return null;
}

function norm(s) { return String(s).replace(/\s+/g, '').toLowerCase(); }

function parseNumericAnswer(text) {
  const normalized = String(text || '')
    .replace(/\$/g, '')
    .replace(/\\dfrac|\\tfrac/g, '\\frac')
    .replace(/，/g, ',')
    .trim();
  const latexFraction = normalized.match(/\\frac\s*\{\s*([-+]?\d*\.?\d+)\s*\}\s*\{\s*([-+]?\d*\.?\d+)\s*\}/);
  if (latexFraction) {
    const denominator = Number(latexFraction[2]);
    return denominator === 0 ? NaN : Number(latexFraction[1]) / denominator;
  }
  const plainFraction = normalized.match(/([-+]?\d*\.?\d+)\s*\/\s*([-+]?\d*\.?\d+)/);
  if (plainFraction) {
    const denominator = Number(plainFraction[2]);
    return denominator === 0 ? NaN : Number(plainFraction[1]) / denominator;
  }
  const number = normalized.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
  return number ? Number(number[0]) : NaN;
}

function buildVerifyOptions(spec, seed = '') {
  if (!spec) return [];
  let options;
  if (spec.kind === 'numeric') {
    const value = Number(spec.value);
    const delta = Math.max(1, Math.abs(value) * 0.2);
    const candidates = [value, value + delta, value - delta, value === 0 ? 2 : value * 2, value === 0 ? 0.5 : value / 2];
    const unique = [];
    for (const candidate of candidates) {
      const rounded = Number(candidate.toPrecision(8));
      if (!unique.some((item) => Math.abs(item - rounded) < 1e-9)) unique.push(rounded);
    }
    while (unique.length < 5) unique.push(Number((value + unique.length + 1).toPrecision(8)));
    options = unique.slice(0, 5).map((item) => `$${item}$`);
  } else {
    const correct = String(spec.value);
    const opposite = correct === '是' ? '否' : correct === '否' ? '是' : `不等于${correct}`;
    options = [correct, opposite, '条件不足，无法判断', '仅在特殊条件下成立', '以上说法都不正确'];
  }
  // 确定性轮换：同一知识点答案位置稳定，但不会永远出现在第一项。
  const offset = [...String(seed)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % options.length;
  return [...options.slice(offset), ...options.slice(0, offset)];
}

export function isCorrect(spec, text) {
  const t = (text || '').trim();
  if (!spec || !t) return false;
  if (spec.kind === 'numeric') {
    const num = parseNumericAnswer(t);
    if (Number.isNaN(num)) return false;
    const tol = spec.tolerance ?? 1e-6;
    return Math.abs(num - spec.value) <= tol;
  }
  if (spec.kind === 'expression') {
    const want = norm(spec.value);
    return norm(t) === want || norm(t).includes(want);
  }
  return false;
}

export async function teachingGenerate({ node_id } = {}) {
  const id = node_id;
  const graph = getGraph();
  const node = graph ? (graph.nodes || []).find((n) => n.id === id) : null;

  if (hasKey() && node) {
    try {
      const res = await chatJson({ system: TEACH_SYSTEM_PROMPT, user: buildTeachUserPrompt(node) });
      if (hasBareMath(res)) throw new Error('教学内容包含未使用 LaTeX 的数学表达');
      if (res && typeof res.definition === 'string' && res.definition.trim()) {
        const spec = normalizeExpected(res.expected_answer);
        if (!spec) throw new Error('验证题缺少可判定的标准答案');
        specCache.set(id, spec);
        return {
          node_id: id,
          definition: pick(res.definition, node.summary),
          intuition: pick(res.intuition, '从直觉上理解该概念，并把它与题目联系起来。'),
          relation: pick(res.relation, '该概念是当前题目某一步的前置知识。'),
          example: pick(res.example, '（示例占位）'),
          pitfall: pick(res.pitfall, '常见误区：跳过关键步骤直接套结论。'),
          verify_question: pick(res.verify_question, '（验证题占位）'),
          verify_options: buildVerifyOptions(spec, id),
        };
      }
    } catch (e) {
      console.warn(`[teaching] DeepSeek 教学生成失败，回退内置库：${e.message}`);
    }
  }

  const t = TEACHINGS[id];
  if (t) {
    specCache.set(id, t.expected_answer);
    const { expected_answer: _drop, ...packet } = t;
    return { ...packet, verify_options: buildVerifyOptions(t.expected_answer, id) }; // 不回传正确项标记
  }
  // 降级占位：图谱中未录入教学库的节点
  return {
    node_id: id ?? 'unknown',
    definition: node ? node.summary : '（通用定义占位）',
    intuition: '从直觉上理解该概念，并把它与题目联系起来。',
    relation: '该概念是当前题目某一步的前置知识。',
    example: '（示例占位，接入完整 6号教学库后由教材证据生成）',
    pitfall: '常见误区：跳过关键步骤直接套结论。',
    verify_question: '（验证题占位）',
    verify_options: ['A', 'B', 'C', 'D', 'E'],
  };
}

export async function teachingEvaluate({ node_id, answer } = {}) {
  const id = node_id;
  const spec = specCache.get(id) || (TEACHINGS[id] && TEACHINGS[id].expected_answer);
  const correct = isCorrect(spec, answer);
  if (correct) {
    return {
      node_id: id,
      mastery: 'mastered',
      score: 0.9,
      evidence: '答案正确，说明已理解该知识点，建议进入下一环节',
      suggested_state: 'green',
    };
  }
  return {
    node_id: id,
    mastery: 'partial',
    score: 0.4,
    evidence: '答案不正确，请回顾上面的「示例」与「易错点」后再试一次',
    suggested_state: 'orange',
  };
}

const EXPLAIN_SYSTEM_PROMPT = `你是一位极有耐心的启蒙老师。学生点击了“没看懂”，请把给定内容重新解释得更通俗。

规则：
1. attempt=1：减少术语，用日常类比解释；attempt=2：再拆成更小步骤；attempt>=3：只保留最核心的一句话和一个极简例子。
2. 不要责备学生，不重复原文，不增加新的难概念。
3. 所有数学变量和表达式必须使用 LaTeX，行内 $...$，独立公式 $$...$$。
4. 只输出 JSON：{"explanation_markdown":"..."}。`;

export async function teachingExplain({ section, content, attempt = 1 } = {}) {
  if (!content) throw new Error('缺少需要解释的内容');
  if (hasKey()) {
    try {
      const result = await chatJson({
        system: EXPLAIN_SYSTEM_PROMPT,
        user: `当前部分：${section || '知识点'}\n学生第 ${attempt} 次表示没看懂。\n原内容：${content}`,
        temperature: 0.35,
      });
      if (typeof result.explanation_markdown === 'string' && result.explanation_markdown.trim()) {
        return { explanation_markdown: result.explanation_markdown.trim() };
      }
    } catch (e) {
      console.warn(`[teaching] 通俗解释生成失败，回退内置解释：${e.message}`);
    }
  }
  const level = Math.min(3, Math.max(1, Number(attempt) || 1));
  const intro = level === 1
    ? '先不看术语，把它理解成一个“越来越靠近”的过程。'
    : level === 2
      ? '我们把它拆成两步：先看输入发生什么，再看输出跟着怎样变化。'
      : '现在只记一句话：先看变化，再看结果最终靠近哪里。';
  return {
    explanation_markdown: `${intro}\n\n原内容中最重要的是：${content}\n\n不用一次全部记住，先确认你能理解其中的一个动作或一个关系。`,
  };
}
