// 种子进度（演示预置）：首次启动时给指定演示账号预置「已建好的知识图谱 + 随机点亮的节点」，
// 让评委登录即可看到现成图谱，无需现场粘贴教材建图。
//
// 安全约定（沿用 docs/08 红线）：
// - 这里只写入「图谱 + 节点点亮状态（mastered/weak）」这些可由 docs/*.md 派生的公开数据；
//   绝不含 session secret、绝不含密码哈希，因此可以安全随仓库提交。
// - 只对「还没有任何真实图谱」的用户做预置；用户自己建过图后一律不覆盖，尊重已有数据。
//
// 随机性：用「账号 + 图谱名」做种子的确定性伪随机（mulberry32），
// 同一个人每次启动生成的结果一致（可复现、便于验证），但看起来是随机分布的十几个节点。
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph } from './md2graph.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, '..', '..', 'docs');

// 每个演示账号预置哪些知识库（doc 对应 docs/ 下的教材文件名）。
const SEED_PLAN = [
  { username: 'Yuxinpu0110', graphs: [{ name: '微积分知识集合', doc: '微积分知识集合.md' }] },
  {
    username: 'Xgyr0613',
    graphs: [
      { name: '军事理论知识集合', doc: '军事理论知识集合.md' },
      { name: '微积分知识集合', doc: '微积分知识集合.md' },
      { name: '线性代数知识集合', doc: '线性代数知识集合.md' },
    ],
  },
];

// 每个知识库随机点亮约十几个节点；每个节点再随机判「已掌握」或「薄弱」。
const LIT_PER_GRAPH = 13;

// 确定性伪随机：mulberry32。种子来自下方 fnv1a。
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a 32 位，把任意字符串折叠成稳定的随机种子。
function fnv1a(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 从图谱节点里随机点亮 LIT_PER_GRAPH 个，并随机分到「已掌握 / 薄弱」两侧。 */
function pickLit(graph, seedStr) {
  const rnd = mulberry32(fnv1a(seedStr));
  const ids = graph.nodes.map((n) => n.id);
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const lit = ids.slice(0, Math.min(LIT_PER_GRAPH, ids.length));
  const mastered = [];
  const weak = [];
  for (const id of lit) (rnd() < 0.5 ? mastered : weak).push(id);
  // 保证演示图里「绿 / 橙」两种状态都至少出现一个（避免极端随机全落到同一边）。
  if (mastered.length && !weak.length) weak.push(mastered.pop());
  else if (weak.length && !mastered.length) mastered.push(weak.pop());
  return { masteredIds: mastered, retainedWeakIds: weak };
}

/** 单个知识库：读教材 → 建图 → 随机点亮节点。doc 缺失或建图失败时返回 null（跳过，不阻断启动）。 */
function buildSeedRecord(username, graphName, docName, index) {
  const docPath = path.join(DOCS_DIR, docName);
  if (!existsSync(docPath)) {
    console.warn(`[seed] 跳过「${graphName}」：找不到 ${docPath}`);
    return null;
  }
  const markdown = readFileSync(docPath, 'utf8');
  const graph = buildGraph(markdown);
  const { masteredIds, retainedWeakIds } = pickLit(graph, `${username}:${graphName}`);
  return {
    id: `seed_${index + 1}`,
    name: graphName,
    textbook: markdown,
    graph,
    masteredIds,
    retainedWeakIds,
  };
}

/** 该用户是否已有真实图谱（有则尊重已有数据，不再预置）。 */
function hasRealProgress(p) {
  if (!p) return false;
  if (p.graph && Array.isArray(p.graph.nodes) && p.graph.nodes.length > 0) return true;
  return Array.isArray(p.knowledgeGraphs) && p.knowledgeGraphs.some(
    (g) => g && g.graph && Array.isArray(g.graph.nodes) && g.graph.nodes.length > 0,
  );
}

/**
 * 把种子进度写入 store.progress（就地修改）。返回是否有写入（有写入需要调用方 persist）。
 * 幂等：已有真实图谱的用户不会被覆盖；二次调用也不会重复预置。
 */
export function applySeedProgress(store) {
  let changed = false;
  for (const plan of SEED_PLAN) {
    const { username } = plan;
    if (!store.users[username]) continue; // 账号尚未建立（理论上不会，演示账号总在前一步建好）
    if (hasRealProgress(store.progress[username])) continue;

    const records = [];
    plan.graphs.forEach((g, i) => {
      const record = buildSeedRecord(username, g.name, g.doc, i);
      if (record) records.push(record);
    });
    if (!records.length) continue;

    const active = records[0];
    store.progress[username] = {
      username,
      textbook: active.textbook,
      graph: active.graph,
      masteredIds: active.masteredIds,
      retainedWeakIds: active.retainedWeakIds,
      knowledgeGraphs: records,
      activeGraphId: active.id,
      updatedAt: new Date().toISOString(),
    };
    changed = true;
    console.log(
      `[seed] 已为 ${username} 预置 ${records.length} 个知识图谱（${records
        .map((r) => `${r.name} ${r.masteredIds.length} 绿 / ${r.retainedWeakIds.length} 橙`)
        .join('；')}）`,
    );
  }
  return changed;
}
