// 用户信息存储（7号）：账号 + 每个用户的学习进度，持久化到 backend/data/store.json。
//
// 安全约定（docs/08）：
// - 密码只以 scrypt 哈希 + 随机 salt 落盘，任何接口都不回传哈希/salt；
// - 会话令牌为 HMAC 签名（无状态），只经 httpOnly Cookie 传输，不落 localStorage、不回传明文；
// - 进度里的 mastered_ids 必须 ⊆ 该用户图谱的 node_id（沿用「不造图谱外 id」红线）；
// - 本模块与 DEEPSEEK_API_KEY 完全无关，两者互不可见。
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySeedProgress } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.KT_DATA_DIR || path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

export const COOKIE_NAME = 'kt_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 天

// 演示账号（与前端 Mock 兜底账号一致）。密码仅在此处以哈希形式落到 store.json，不存明文。
const DEMO_ACCOUNTS = [
  ['admin', 'admin', '超级管理员', 'super'],
  ['Yuxinpu0110', 'abcde0110', 'Yuxinpu', 'user'],
  ['Xgyr0613', 'tsy0821', 'Xgyr', 'user'],
  ['Tujuanjuan', 'Lyx0623', 'Tujuanjuan', 'user'],
  ['WenZhaobo0220', '303603', 'WenZhaobo', 'user'],
  ['liuhan666', 'liuhan666', 'liuhan', 'user'],
  ['An1031', '311007', 'An', 'user'],
];

const MAX_GRAPH_JSON = 4 * 1024 * 1024; // 单用户图谱上限 4MB，防止写爆磁盘

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(String(password), salt, 64).toString('hex') };
}

function verifyPassword(password, salt, hash) {
  try {
    const candidate = scryptSync(String(password), salt, 64);
    const expected = Buffer.from(hash, 'hex');
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

let store = null;

function emptyStore() {
  return { secret: randomBytes(32).toString('hex'), users: {}, progress: {} };
}

function load() {
  try {
    if (existsSync(STORE_PATH)) {
      const parsed = JSON.parse(readFileSync(STORE_PATH, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        return {
          secret: parsed.secret || randomBytes(32).toString('hex'),
          users: parsed.users || {},
          progress: parsed.progress || {},
        };
      }
    }
  } catch (e) {
    console.warn(`[users] store.json 读取失败，重建：${e.message}`);
  }
  return emptyStore();
}

function persist() {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.warn(`[users] store.json 写入失败：${e.message}`);
  }
}

function ensureDemoAccounts() {
  let added = 0;
  for (const [username, password, displayName, role] of DEMO_ACCOUNTS) {
    if (store.users[username]) continue;
    const { salt, hash } = hashPassword(password);
    store.users[username] = { username, displayName, role, salt, hash, createdAt: new Date().toISOString() };
    added += 1;
  }
  if (added) {
    persist();
    console.log(`[users] 已初始化 ${added} 个演示账号（密码以 scrypt 哈希保存）`);
  }
}

export function initUsers() {
  store = load();
  ensureDemoAccounts();
  // 演示账号首次启动时预置种子进度（已建好的图谱 + 随机点亮节点），已有真实图谱则不覆盖。
  if (applySeedProgress(store)) persist();
  return STORE_PATH;
}

function ensure() {
  if (!store) initUsers();
  return store;
}

// 只暴露可安全回传前端的字段（绝不含 salt/hash）。
function publicUser(u) {
  return { username: u.username, displayName: u.displayName, role: u.role };
}

export function login(username, password) {
  const s = ensure();
  const u = s.users[String(username || '').trim()];
  if (!u) return null;
  if (!verifyPassword(password, u.salt, u.hash)) return null;
  return publicUser(u);
}

export function register(username, password, displayName) {
  const s = ensure();
  const name = String(username || '').trim();
  if (!/^[A-Za-z0-9_]{3,32}$/.test(name)) throw new Error('用户名需为 3~32 位字母、数字或下划线');
  if (String(password || '').length < 4) throw new Error('密码至少 4 位');
  if (s.users[name]) throw new Error('该用户名已存在');
  const { salt, hash } = hashPassword(password);
  s.users[name] = {
    username: name,
    displayName: String(displayName || name).slice(0, 32),
    role: 'user',
    salt,
    hash,
    createdAt: new Date().toISOString(),
  };
  persist();
  return publicUser(s.users[name]);
}

export function hasUser(username) {
  return Boolean(ensure().users[String(username || '').trim()]);
}

// ---- 会话令牌：HMAC 签名，无状态（后端重启后仍有效） ----
export function issueToken(username) {
  const s = ensure();
  const payload = `${username}.${Date.now() + SESSION_TTL_MS}`;
  const sig = createHmac('sha256', s.secret).update(payload).digest('hex');
  return Buffer.from(`${payload}.${sig}`, 'utf8').toString('base64url');
}

export function verifyToken(token) {
  if (!token) return null;
  const s = ensure();
  try {
    const raw = Buffer.from(String(token), 'base64url').toString('utf8');
    const idx = raw.lastIndexOf('.');
    if (idx < 0) return null;
    const payload = raw.slice(0, idx);
    const sig = raw.slice(idx + 1);
    const expected = createHmac('sha256', s.secret).update(payload).digest('hex');
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const sep = payload.lastIndexOf('.');
    const username = payload.slice(0, sep);
    const exp = Number(payload.slice(sep + 1));
    if (!Number.isFinite(exp) || Date.now() > exp) return null;
    return s.users[username] ? publicUser(s.users[username]) : null;
  } catch {
    return null;
  }
}

export function getUser(username) {
  const u = ensure().users[String(username || '').trim()];
  return u ? publicUser(u) : null;
}

// ---- 学习进度 ----
function graphNodeIds(graph) {
  if (!graph || !Array.isArray(graph.nodes)) return null;
  return new Set(graph.nodes.map((n) => n && n.id).filter(Boolean));
}

export function getProgress(username) {
  const p = ensure().progress[String(username || '').trim()];
  return p ? { ...p } : null;
}

// 保存进度：只接受约定字段；mastered_ids 过滤到图谱真实存在的 node_id。
export function saveProgress(username, patch) {
  const s = ensure();
  const name = String(username || '').trim();
  if (!s.users[name]) throw new Error('用户不存在');
  const prev = s.progress[name] || {};
  const next = { ...prev, username: name };

  if (patch && typeof patch === 'object') {
    if (typeof patch.textbook === 'string') next.textbook = patch.textbook.slice(0, 200000);
    if ('graph' in patch) {
      if (patch.graph && Array.isArray(patch.graph.nodes) && Array.isArray(patch.graph.edges)) {
        const json = JSON.stringify(patch.graph);
        if (json.length > MAX_GRAPH_JSON) throw new Error('图谱数据过大');
        next.graph = patch.graph;
      } else if (patch.graph === null) {
        next.graph = null;
      }
    }
    if (Array.isArray(patch.masteredIds)) {
      const ids = graphNodeIds(next.graph);
      const wanted = patch.masteredIds.filter((x) => typeof x === 'string');
      // 图谱存在时严格过滤；图谱为空时不允许写入已掌握（避免孤儿 id）
      next.masteredIds = ids ? [...new Set(wanted.filter((id) => ids.has(id)))] : [];
    }
    if (Array.isArray(patch.retainedWeakIds)) {
      const ids = graphNodeIds(next.graph);
      const wanted = patch.retainedWeakIds.filter((x) => typeof x === 'string');
      next.retainedWeakIds = ids ? [...new Set(wanted.filter((id) => ids.has(id)))] : [];
    }
    if (Array.isArray(patch.knowledgeGraphs)) {
      if (patch.knowledgeGraphs.length > 30) throw new Error('单个用户最多保存 30 个知识图谱');
      const serialized = JSON.stringify(patch.knowledgeGraphs);
      if (serialized.length > MAX_GRAPH_JSON) throw new Error('知识图谱数据总量过大');
      next.knowledgeGraphs = patch.knowledgeGraphs.map((item, index) => {
        const graph = item?.graph && Array.isArray(item.graph.nodes) && Array.isArray(item.graph.edges)
          ? item.graph
          : null;
        const ids = graphNodeIds(graph);
        const mastered = Array.isArray(item?.masteredIds) ? item.masteredIds.filter((id) => typeof id === 'string') : [];
        const weak = Array.isArray(item?.retainedWeakIds) ? item.retainedWeakIds.filter((id) => typeof id === 'string') : [];
        return {
          id: String(item?.id || `graph_${index + 1}`).slice(0, 100),
          name: String(item?.name || `知识图谱 ${index + 1}`).trim().slice(0, 80),
          textbook: typeof item?.textbook === 'string' ? item.textbook.slice(0, 200000) : '',
          graph,
          masteredIds: ids ? [...new Set(mastered.filter((id) => ids.has(id)))] : [],
          retainedWeakIds: ids ? [...new Set(weak.filter((id) => ids.has(id)))] : [],
        };
      });
    }
    if (typeof patch.activeGraphId === 'string') {
      const wanted = patch.activeGraphId.slice(0, 100);
      if (next.knowledgeGraphs?.some((item) => item.id === wanted)) next.activeGraphId = wanted;
    }
  }
  next.updatedAt = new Date().toISOString();
  s.progress[name] = next;
  persist();
  return { ...next };
}
