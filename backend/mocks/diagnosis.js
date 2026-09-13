// 5号 诊断 Mock（2~5 轮选择题：这里给 5 题 + 1 终局，含 canned next_options 与多薄弱点 weak_points）。
const SEED_NODES = [{ node_id: 'derivative_definition', relevance: 0.94, reason: '题目直接考查导数定义' }];
const ACTIVATED = [
  { node_id: 'derivative_definition', distance: 0, brightness: 1.0, state: 'question_related' },
  { node_id: 'limit_definition', distance: 1, brightness: 0.72, state: 'suspected_gap' },
  { node_id: 'derivative_rules', distance: 1, brightness: 0.72, state: 'recommended' },
];

// 数组下标 = round（已作答次数）；最后一元素为终局（done=true）。
const DIAGNOSIS_ROUNDS = [
  {
    suspected_gap: { node_id: 'limit_definition', confidence: 0.62, reason: '初步怀疑：差商取极限的步骤不清晰' },
    weak_points: [
      { node_id: 'limit_definition', confidence: 0.62 },
      { node_id: 'derivative_rules', confidence: 0.42 },
    ],
    next_question: '当 h 趋近于 0 时，差商 [f(x0+h)-f(x0)]/h 应当如何处理？',
    next_options: [
      { text: '令 h 趋近于 0 并取极限', signal: 'correct' },
      { text: '直接令 h=0 代入', signal: 'fuzzy' },
      { text: '把 h 设为任意大的数', signal: 'dontknow' },
    ],
    done: false,
  },
  {
    suspected_gap: { node_id: 'limit_definition', confidence: 0.72, reason: '进一步怀疑：用户无法解释取极限过程' },
    weak_points: [
      { node_id: 'limit_definition', confidence: 0.72 },
      { node_id: 'derivative_rules', confidence: 0.46 },
    ],
    next_question: '为什么不能直接把 h=0 代入？',
    next_options: [
      { text: '因为分母会变为 0，需先化简', signal: 'correct' },
      { text: '因为 h 是未知数', signal: 'fuzzy' },
      { text: '因为计算器会报错', signal: 'dontknow' },
    ],
    done: false,
  },
  {
    suspected_gap: { node_id: 'limit_definition', confidence: 0.8, reason: '确认：用户无法解释取极限的过程' },
    weak_points: [
      { node_id: 'limit_definition', confidence: 0.8 },
      { node_id: 'derivative_rules', confidence: 0.5 },
    ],
    next_question: '差商化简后，剩下的关键运算是什么？',
    next_options: [
      { text: '约去公因子后再取极限', signal: 'correct' },
      { text: '直接按计算器结果填答案', signal: 'fuzzy' },
      { text: '随便猜一个数', signal: 'dontknow' },
    ],
    done: false,
  },
  {
    suspected_gap: { node_id: 'limit_definition', confidence: 0.88, reason: '基本确认：极限概念掌握不足' },
    weak_points: [
      { node_id: 'limit_definition', confidence: 0.88 },
      { node_id: 'derivative_rules', confidence: 0.53 },
    ],
    next_question: '「极限存在」意味着函数值无限接近某个常数，对吗？',
    next_options: [
      { text: '对，函数值无限接近该常数', signal: 'correct' },
      { text: '不对，极限就是直接代入该点', signal: 'fuzzy' },
      { text: '极限是函数的最大值', signal: 'dontknow' },
    ],
    done: false,
  },
  {
    suspected_gap: { node_id: 'limit_definition', confidence: 0.93, reason: '确认：用户能列出差商但不会取极限' },
    weak_points: [
      { node_id: 'limit_definition', confidence: 0.93 },
      { node_id: 'derivative_rules', confidence: 0.55 },
    ],
    next_question: '求导的本质是对差商做什么操作？',
    next_options: [
      { text: '对差商取 h→0 的极限', signal: 'correct' },
      { text: '对差商求平方', signal: 'fuzzy' },
      { text: '对差商取对数', signal: 'dontknow' },
    ],
    done: false,
  },
  {
    suspected_gap: { node_id: 'limit_definition', confidence: 0.93, reason: '用户能列出差商，但无法解释差商取极限的过程' },
    weak_points: [
      { node_id: 'limit_definition', confidence: 0.93 },
      { node_id: 'derivative_rules', confidence: 0.55 },
    ],
    next_question: null,
    next_options: null,
    done: true,
  },
];

export function mockDiagnosisNext({ round = 0, question = '求函数在某点的导数' } = {}) {
  const idx = Math.min(Math.max(0, Math.floor(round)), DIAGNOSIS_ROUNDS.length - 1);
  const r = DIAGNOSIS_ROUNDS[idx];
  return {
    question,
    seed_nodes: SEED_NODES,
    suspected_gap: r.suspected_gap,
    weak_points: r.weak_points,
    activated_nodes: ACTIVATED,
    next_question: r.next_question,
    next_options: r.next_options ?? null,
    done: r.done,
  };
}
