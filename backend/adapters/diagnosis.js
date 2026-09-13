// 5号模块适配：断点诊断（从 HTML 交互引擎移植为后端 round-based 阶段式返回）。
// 保留 5号的诊断规则：候选断点沿 prerequisite 向前追溯、置信度因子更新、
// 本地 BFS 点亮（3 跳，brightness=max(0.15, 0.72^d)）、最多 3 轮收口。
// 与前端约定：round=0 返回第一问；后续 round 携带上一轮文字回答，返回下一问或 done=true。
import { getGraph, getSeedNodes } from './state.js';
import { chatJson, hasKey } from './deepseek.js';

const FACTOR = { correct: 0.35, partial: 0.7, wrong: 1.5, fuzzy: 1.1, dontknow: 1.45 };
const STOP_WORDS = ['不会', '不知道', '不懂', '忘了', '忘记', '记不清', '没学过', '不清楚', '难'];
const MIN_ROUNDS = 2;
const MAX_ROUNDS = 5;
const BFS_HOPS = 3;
const GAP_THRESHOLD = 0.4;
const WEAK_THRESHOLD = 0.25; // 低于此置信度不点亮（避免噪声）
const WEAK_MAX = 5; // 最多点亮 5 个薄弱点

// 诊断选择题：1 正确 + 1 半错(模糊) + 1 绝错(不会)。
const SIGNALS = ['correct', 'fuzzy', 'dontknow'];

const DIAG_SYSTEM_PROMPT = `你是「知识点掌握度诊断专家」。针对给定知识点出一道单选题，用来判断学生是否真正掌握了它。

硬规则：
1. question 用一句自然的话考察该知识点的核心理解，可用 LaTeX（$...$ 或 $$...$$）。
2. options 恰好 3 项，每项是 {"text":"...","signal":"..."}：
   - 1 项 signal="correct"：正确陈述或正确结论；
   - 1 项 signal="fuzzy"：似是而非的半错选项（一知半解的学生容易误选）；
   - 1 项 signal="dontknow"：明显错误、完全不懂的学生才会选。
3. signal="correct" 的选项必须与「知识点摘要/关键词」严格一致、可被教材原文验证，不得自创与摘要冲突的结论。
4. 三个 signal 只能各出现一次；选项顺序随机打乱，不要把正确项固定放第一。
5. 只输出一个 JSON 对象：{"question":"...","options":[{"text":"...","signal":"correct"},{"text":"...","signal":"fuzzy"},{"text":"...","signal":"dontknow"}]}，不要代码块、不要解释。`;

function buildMcqUserPrompt(node) {
  return `知识点名称：${node.name}\n所属章节：${node.chapter || ''}\n摘要：${node.summary || ''}\n关键词：${(node.keywords || []).join('、')}\n\n请为该知识点出一道诊断单选题。`;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function validOptions(options) {
  if (!Array.isArray(options) || options.length !== 3) return false;
  const seen = new Set();
  for (const o of options) {
    if (!o || typeof o.text !== 'string' || !o.text.trim()) return false;
    if (!SIGNALS.includes(o.signal)) return false;
    seen.add(o.signal);
  }
  return seen.size === 3;
}

const DEFAULT_SEED = [{ node_id: 'derivative_definition', relevance: 0.94, reason: '题目直接考查导数定义' }];

// 出题后的「自检」：独立调用审校，逐项验证 signal 标注（尤其 correct 项是否真正确）。
const VERIFY_SYSTEM_PROMPT = `你是「题目审校员」。给你一道单选题和它的三个选项，判断这道题的 signal 标注是否正确。

判断标准：
1. signal="correct" 的选项必须是这道题真正正确的答案；
2. signal="fuzzy" 的选项必须是似是而非的错误（看似有道理实则错）；
3. signal="dontknow" 的选项必须是明显错误。
只要有一条不满足，valid 就为 false。
只输出一个 JSON 对象：{"valid": true/false, "reason": "一句话原因"}，不要代码块、不要解释。`;

function buildVerifyUserPrompt(node, question, options) {
  const list = options.map((o) => `- [${o.signal}] ${o.text}`).join('\n');
  return `知识点：${node.name}（${node.summary || ''}）\n题干：${question}\n选项：\n${list}\n\n请逐项核对：correct 项是否确为正确答案？fuzzy/dontknow 项是否确为错误？`;
}

async function verifyMcq(node, question, options) {
  try {
    const res = await chatJson({ system: VERIFY_SYSTEM_PROMPT, user: buildVerifyUserPrompt(node, question, options) });
    return res.valid === true;
  } catch (e) {
    // 审校器自身不可用（网络/超时）时不丢弃已生成的题，避免因审校失败而整题回退
    console.warn(`[diagnosis] 自检调用失败，放行原题：${e.message}`);
    return true;
  }
}

const sessions = new Map(); // question -> session

function nodeIndex(graph) {
  const m = new Map();
  (graph.nodes || []).forEach((n) => m.set(n.id, n));
  return m;
}

function collectPrerequisites(graph, seedIds, depth = 2) {
  const dep = new Map();
  let frontier = new Set(seedIds);
  for (let d = 0; d < depth; d++) {
    const next = new Set();
    (graph.edges || []).forEach((e) => {
      if (!frontier.has(e.target)) return;
      if (e.relation !== 'prerequisite') return;
      if (seedIds.includes(e.source)) return;
      next.add(e.source);
      dep.set(e.source, Math.max(dep.get(e.source) || 0, e.weight || 0.5));
    });
    frontier = next;
  }
  return Array.from(dep.entries()).map(([id, w]) => ({ id, weight: w }));
}

function judgeAnswer(node, text) {
  const t = (text || '').trim();
  if (!t) return 'fuzzy';
  if (STOP_WORDS.some((w) => t.includes(w))) return 'wrong';
  const keys = (node.keywords || []).filter((k) => k && t.includes(k));
  if (keys.length >= 2) return 'correct';
  if (keys.length === 1) return 'partial';
  return 'wrong';
}

function computeActivation(graph, seedNodes, suspectedId) {
  const adj = new Map();
  (graph.edges || []).forEach((e) => {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source).push(e.target);
    adj.get(e.target).push(e.source);
  });
  const dist = new Map();
  const q = [];
  seedNodes.forEach((s) => { dist.set(s.node_id, 0); q.push(s.node_id); });
  while (q.length) {
    const u = q.shift();
    const du = dist.get(u);
    if (du >= BFS_HOPS) continue;
    (adj.get(u) || []).forEach((v) => { if (!dist.has(v)) { dist.set(v, du + 1); q.push(v); } });
  }
  const seedSet = new Set(seedNodes.map((s) => s.node_id));
  const idx = nodeIndex(graph);
  const arr = [];
  dist.forEach((d, id) => {
    let state = 'inactive';
    if (seedSet.has(id)) state = 'question_related';
    if (id === suspectedId) state = 'suspected_gap';
    arr.push({
      node_id: id,
      name: idx.get(id) ? idx.get(id).name : id,
      distance: d,
      brightness: Math.max(0.15, 1 * Math.pow(0.72, d)),
      state,
    });
  });
  return arr.sort((a, b) => a.distance - b.distance);
}

async function buildQuestion(node) {
  if (hasKey()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await chatJson({ system: DIAG_SYSTEM_PROMPT, user: buildMcqUserPrompt(node) });
        if (!(typeof res.question === 'string' && res.question.trim() && validOptions(res.options))) {
          continue;
        }
        const question = res.question.trim();
        const options = shuffle(res.options.map((o) => ({ text: o.text.trim(), signal: o.signal })));
        // 自检通过才采纳；不通过则重出一次
        if (await verifyMcq(node, question, options)) {
          return { question, options };
        }
        console.warn('[diagnosis] DeepSeek 出题自检未通过，重新生成');
      } catch (e) {
        console.warn(`[diagnosis] DeepSeek 出题失败：${e.message}`);
        break;
      }
    }
  }
  return {
    question: `关于「${node.name}」，下面哪一项描述最准确？`,
    options: shuffle([
      { text: node.summary || `它是「${node.name}」的核心定义与基本性质。`, signal: 'correct' },
      { text: `只要记住「${node.name}」的名称，不理解条件也能直接应用。`, signal: 'fuzzy' },
      { text: `它与当前题目及其前置知识完全没有关系。`, signal: 'dontknow' },
    ]),
  };
}

function createSession(graph, seedNodes) {
  const idx = nodeIndex(graph);
  const validSeeds = seedNodes.filter((s) => idx.has(s.node_id));
  const seeds = validSeeds.length ? validSeeds : DEFAULT_SEED.filter((s) => idx.has(s.node_id));
  if (!seeds.length) throw new Error('图谱中找不到题目相关种子节点');

  const seedIds = seeds.map((s) => s.node_id);
  const relAvg = seeds.reduce((a, s) => a + (s.relevance || 0.5), 0) / seeds.length;
  const candidates = new Map();
  // 题目直接命中的知识点必须参与诊断。它代表“表层疑点”，初始置信度较低，
  // 第一题先验证它；之后再沿 prerequisite 追溯真正的前置断点。
  seeds.forEach((s) => {
    candidates.set(s.node_id, {
      node: idx.get(s.node_id),
      confidence: Math.min(0.42, Math.max(0.28, 0.18 + (s.relevance || 0.5) * 0.22)),
      asked: false,
      direct: true,
    });
  });
  collectPrerequisites(graph, seedIds).forEach((c) => {
    const node = idx.get(c.id);
    candidates.set(c.id, {
      node,
      // 首轮保持中等置信度，给后续回答留下清晰的视觉收敛空间。
      confidence: Math.min(0.62, Math.max(0.28, c.weight * relAvg * 0.65)),
      asked: false,
      direct: false,
    });
  });
  // 保证至少 MIN_ROUNDS 道题：候选不足时用种子节点补齐。
  if (candidates.size < MIN_ROUNDS) {
    seeds.forEach((s) => {
      if (candidates.size >= MIN_ROUNDS || candidates.has(s.node_id)) return;
      candidates.set(s.node_id, { node: idx.get(s.node_id), confidence: 0.5, asked: false });
    });
  }
  return { seedNodes: seeds, candidates, currentId: null, askedCount: 0, done: false, history: [] };
}

function pickNext(session) {
  let best = null;
  session.candidates.forEach((c, id) => {
    if (c.asked) return;
    if (!best || (c.direct && !best.direct) || (c.direct === best.direct && c.confidence > best.confidence)) {
      best = { id, ...c };
    }
  });
  if (best) return best;
  // 都问过但未到最少题数：重问置信度最高的，加深判断。
  if (session.askedCount < MIN_ROUNDS) {
    let top = null;
    session.candidates.forEach((c, id) => { if (!top || c.confidence > top.confidence) top = { id, ...c }; });
    return top;
  }
  return null;
}

function askOne(session) {
  const cand = pickNext(session);
  if (!cand) return null;
  cand.asked = true;
  session.candidates.set(cand.id, cand);
  session.currentId = cand.id;
  session.askedCount += 1;
  return cand;
}

function applyAnswer(session, answer, signal) {
  if (!session.currentId) return;
  const c = session.candidates.get(session.currentId);
  if (!c) return;
  const sig = signal && SIGNALS.includes(signal) ? signal : judgeAnswer(c.node, answer);
  c.confidence = Math.min(0.98, Math.max(0.05, c.confidence * FACTOR[sig]));
  session.history.push({ nodeId: session.currentId, signal: sig });
}

// 每轮返回当前最佳候选（用于前端可视化薄弱点随诊断逐轮变清晰），不限阈值。
function runningBest(session, graph) {
  let best = null;
  session.candidates.forEach((c, id) => { if (!best || c.confidence > best.confidence) best = { id, ...c }; });
  if (!best) return null;
  const n = nodeIndex(graph).get(best.id);
  return {
    node_id: best.id,
    name: n ? n.name : best.id,
    confidence: Number(best.confidence.toFixed(2)),
    reason: `诊断中：该前置概念疑似薄弱（置信度 ${(best.confidence * 100).toFixed(0)}%）`,
  };
}

// 每轮返回所有超过阈值的候选薄弱点（供前端多点橙红点亮，亮度随置信度）。
function runningWeakPoints(session, graph) {
  const idx = nodeIndex(graph);
  const arr = [];
  session.candidates.forEach((c, id) => {
    if (c.confidence < WEAK_THRESHOLD) return;
    const n = idx.get(id);
    arr.push({
      node_id: id,
      confidence: Number(c.confidence.toFixed(2)),
      reason: n ? `${n.name}（置信度 ${(c.confidence * 100).toFixed(0)}%）` : '',
    });
  });
  arr.sort((a, b) => b.confidence - a.confidence);
  return arr.slice(0, WEAK_MAX);
}

function finalize(session, graph, question) {
  let best = null;
  session.candidates.forEach((c, id) => { if (!best || c.confidence > best.confidence) best = { id, ...c }; });
  const suspectedId = best && best.confidence >= GAP_THRESHOLD ? best.id : null;
  let suspectedGap = null;
  if (suspectedId) {
    const n = nodeIndex(graph).get(suspectedId);
    const c = session.candidates.get(suspectedId);
    suspectedGap = {
      node_id: suspectedId,
      name: n ? n.name : suspectedId,
      confidence: c ? Number(c.confidence.toFixed(2)) : 0,
      reason: `诊断推断：用户对该前置概念掌握不足（置信度 ${(c.confidence * 100).toFixed(0)}%）`,
    };
  }
  session.done = true;
  return {
    question,
    seed_nodes: session.seedNodes,
    suspected_gap: suspectedGap,
    weak_points: runningWeakPoints(session, graph),
    activated_nodes: computeActivation(graph, session.seedNodes, suspectedId),
    next_question: null,
    done: true,
  };
}

export async function diagnosisNext({ round = 0, question, answer, signal, seed_nodes } = {}) {
  const graph = getGraph();
  if (!graph) throw new Error('尚未生成知识图谱，无法诊断');
  const q = question || '求函数在某点的导数';
  const seeds = seed_nodes && seed_nodes.length ? seed_nodes : getSeedNodes();

  let session = sessions.get(q);
  // round=0 永远代表一次全新的诊断，不能复用同题目之前已经完成的会话。
  if (!session || (Number(round) || 0) === 0) {
    session = createSession(graph, seeds && seeds.length ? seeds : DEFAULT_SEED);
    sessions.set(q, session);
  }

  const r = Number(round) || 0;

  if (r === 0) {
    const cand = askOne(session);
    if (!cand) return finalize(session, graph, q);
    const qq = await buildQuestion(cand.node);
    return {
      question: q,
      seed_nodes: session.seedNodes,
      suspected_gap: null,
      weak_points: runningWeakPoints(session, graph),
      activated_nodes: computeActivation(graph, session.seedNodes, null),
      next_question: qq.question,
      next_options: qq.options,
      done: false,
    };
  }

  applyAnswer(session, answer, signal);

  if (session.askedCount >= MAX_ROUNDS) {
    return finalize(session, graph, q);
  }
  const next = askOne(session);
  if (!next) return finalize(session, graph, q);
  const qq = await buildQuestion(next.node);
  const best = runningBest(session, graph);
  return {
    question: q,
    seed_nodes: session.seedNodes,
    suspected_gap: best,
    weak_points: runningWeakPoints(session, graph),
    activated_nodes: computeActivation(graph, session.seedNodes, best?.node_id ?? null),
    next_question: qq.question,
    next_options: qq.options,
    done: false,
  };
}
