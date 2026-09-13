import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  mockRecognize,
  mockLocate,
  mockDiagnosisNext,
  mockTeachingGenerate,
  mockEvaluate,
  mockTeachingExplain,
  mockAnswerQuestion,
} from './mock.js';

// 各模块真实适配器（2/5/6 为纯 JS；4 优先 DeepSeek，无 Key 时先试 locate_bridge.py，
// 该步失败会被 serve() 兜住并回退到纯 JS 的 mocks/locate.js —— 所以整条链路不依赖 Python）
import { generateGraph } from './adapters/graph.js';
import { locate } from './adapters/locate.js';
import { diagnosisNext } from './adapters/diagnosis.js';
import { teachingGenerate, teachingEvaluate, teachingExplain } from './adapters/teaching.js';
import { answerQuestion } from './adapters/answer.js';
import { setGraph, setSeedNodes, getGraph } from './adapters/state.js';
import { setApiKey, getApiKey, keySource } from './adapters/key.js';
import {
  initUsers,
  login,
  register,
  issueToken,
  verifyToken,
  getProgress,
  saveProgress,
  COOKIE_NAME,
} from './adapters/users.js';

const app = express();
const PORT = process.env.PORT || 3001;
const MOCK_DELAY_MS = Number(process.env.MOCK_DELAY_MS ?? 250);

app.use(express.json({ limit: '8mb' }));

app.use((req, res, next) => {
  // 会话 Cookie 需要凭据：有 Origin 时回显该 Origin（不能用 *，否则浏览器会拒收 Cookie）
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-simulate-fail');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) setTimeout(next, MOCK_DELAY_MS);
  else next();
});

app.use('/api', (req, res, next) => {
  if (req.get('x-simulate-fail') === '1') {
    return res.status(500).json({ ok: false, error: { code: 'SIMULATED_FAILURE', message: '模拟模块故障' } });
  }
  next();
});

const ok = (res, data, mock) => res.json({ ok: true, mock, data });

// 统一接线：真实模块优先，失败（缺 Key / 脚本不可用 / 结构非法）时回退 Mock，保证不崩溃。
async function serve(res, name, adapterFn, mockFn) {
  const t0 = Date.now();
  try {
    const data = await adapterFn();
    console.log(`[adapter] ${name} 真实模块完成 (${Date.now() - t0}ms)`);
    return ok(res, data, false);
  } catch (e) {
    console.warn(`[adapter] ${name} 失败，回退 Mock：${e.message}`);
    return ok(res, mockFn(), true);
  }
}

app.get('/api/health', (req, res) => ok(res, { status: 'up', mock: false }, false));

// 2号：Markdown -> graph.json
app.post('/api/graph/generate', async (req, res) => {
  const { markdown } = req.body ?? {};
  try {
    const graph = await generateGraph(markdown);
    setGraph(graph);
    console.log(`[adapter] graph/generate 完成：${graph.nodes.length} 节点`);
    ok(res, { graph }, false);
  } catch (e) {
    console.error(`[adapter] graph/generate 失败：${e.message}`);
    res.status(500).json({ ok: false, error: { code: 'GRAPH_GENERATION_FAILED', message: `知识图谱生成失败：${e.message}` } });
  }
});

// 3号：题目识别（OCR 缺失，用文字兜底，暂保持 Mock）
app.post('/api/question/recognize', (req, res) => {
  const { text } = req.body ?? {};
  ok(res, mockRecognize({ text }), true);
});

// 4号：题目 -> 相关节点定位
app.post('/api/question/locate', async (req, res) => {
  const rec = req.body?.recognized_question ?? {};
  const question = rec.problem_markdown || '';
  const requestGraph = req.body?.graph;
  await serve(
    res,
    'question/locate',
    async () => {
      if (requestGraph?.nodes?.length) setGraph(requestGraph);
      const graph = requestGraph?.nodes?.length ? requestGraph : getGraph();
      if (!graph) throw new Error('缺少知识图谱（先执行 /api/graph/generate）');
      const r = await locate(question, graph.nodes);
      setSeedNodes(r.seed_nodes);
      return r;
    },
    () => mockLocate({ question, nodes: (requestGraph?.nodes?.length ? requestGraph : getGraph())?.nodes }),
  );
});

// 题目直接解答：覆盖判断和节点定位通过后调用，再由用户决定是否开始诊断。
app.post('/api/question/answer', async (req, res) => {
  const { question, seed_nodes } = req.body ?? {};
  await serve(
    res,
    'question/answer',
    () => answerQuestion({ question, seed_nodes }),
    () => mockAnswerQuestion({ question, seed_nodes, nodes: getGraph()?.nodes }),
  );
});

// 5号：诊断对话（多轮追问，含选择题 signal）
app.post('/api/diagnosis/next', async (req, res) => {
  const { round, question, answer, signal, seed_nodes } = req.body ?? {};
  await serve(
    res,
    'diagnosis/next',
    () => diagnosisNext({ round: Number(round) || 0, question, answer, signal, seed_nodes }),
    () => mockDiagnosisNext({ round: Number(round) || 0, question }),
  );
});

// 6号：单节点教学 + 验证评估
app.post('/api/teaching/generate', async (req, res) => {
  const { node_id, graph: requestGraph } = req.body ?? {};
  await serve(
    res,
    'teaching/generate',
    () => {
      // 与 question/locate 一致：请求里带了图谱就先登记，保证「直接学习」
      // 这类没有前置 graph/generate 的入口也能拿到图谱、走 DeepSeek 教学。
      if (requestGraph?.nodes?.length) setGraph(requestGraph);
      return teachingGenerate({ node_id });
    },
    () => mockTeachingGenerate({ node_id }),
  );
});

app.post('/api/teaching/evaluate', async (req, res) => {
  const { node_id, answer } = req.body ?? {};
  await serve(
    res,
    'teaching/evaluate',
    () => teachingEvaluate({ node_id, answer }),
    () => mockEvaluate({ node_id, answer }),
  );
});

app.post('/api/teaching/explain', async (req, res) => {
  const { section, content, attempt } = req.body ?? {};
  await serve(
    res,
    'teaching/explain',
    () => teachingExplain({ section, content, attempt }),
    () => mockTeachingExplain({ section, content, attempt }),
  );
});

// 调试用：界面设置 API Key（只存内存，不写文件、不回传 key 本身）。key 优先于环境变量。
app.post('/api/config/key', (req, res) => {
  const { api_key } = req.body ?? {};
  setApiKey(api_key);
  ok(res, { source: keySource(), has_key: Boolean(getApiKey()) }, false);
});

app.post('/api/config/status', (req, res) => {
  ok(res, { source: keySource(), has_key: Boolean(getApiKey()) }, false);
});

// ==================== 用户信息存储（登录 + 学习进度） ====================
// 安全：密码 scrypt 哈希落盘；会话令牌 HMAC 签名，只经 httpOnly Cookie 传输，
// 不回传 token / 密码哈希，不写前端 localStorage（前端只存展示用的用户名与昵称）。
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`,
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

const currentUser = (req) => verifyToken(readCookie(req, COOKIE_NAME));

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: '未登录或会话已过期' } });
    return null;
  }
  return user;
}

function fail(res, status, code, message) {
  res.status(status).json({ ok: false, error: { code, message } });
}

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body ?? {};
  const user = login(username, password);
  if (!user) return fail(res, 401, 'BAD_CREDENTIALS', '账号或密码错误');
  setSessionCookie(res, issueToken(user.username));
  console.log(`[auth] 登录成功：${user.username}`);
  ok(res, user, false);
});

app.post('/api/auth/register', (req, res) => {
  const { username, password, displayName } = req.body ?? {};
  try {
    const user = register(username, password, displayName);
    setSessionCookie(res, issueToken(user.username));
    console.log(`[auth] 注册成功：${user.username}`);
    ok(res, user, false);
  } catch (e) {
    fail(res, 400, 'REGISTER_FAILED', e.message);
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(res);
  ok(res, { ok: true }, false);
});

app.post('/api/auth/me', (req, res) => {
  const user = currentUser(req);
  if (!user) return fail(res, 401, 'UNAUTHORIZED', '未登录');
  ok(res, user, false);
});

app.post('/api/user/load-progress', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  ok(res, getProgress(user.username), false);
});

app.post('/api/user/progress', (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  try {
    ok(res, saveProgress(user.username, req.body?.progress), false);
  } catch (e) {
    fail(res, 400, 'SAVE_FAILED', e.message);
  }
});

// ==================== 前端静态托管（单进程交付模式） ====================
// 交付版只有一个进程：本文件既提供 /api，也把前端构建产物挂在根路径，
// 双击「启动.bat」即可，不需要另开 Vite。
// 开发期不受影响：dist 不存在时整段跳过，行为与原来完全一致（Vite 5173 照常代理到 3001）。
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = process.env.KT_WEB_DIR
  ? path.resolve(process.env.KT_WEB_DIR)
  : path.resolve(__dirname, '..', 'frontend', 'dist');
const SERVE_WEB = process.env.KT_SERVE_WEB !== '0' && existsSync(path.join(WEB_DIR, 'index.html'));

if (SERVE_WEB) {
  app.use(express.static(WEB_DIR));
  // SPA fallback：前端 router.ts 用的是 History API，直链 /edit、/learn 刷新必须回 index.html。
  // 但绝不能吃掉 /api/* —— 前端 api/auth.ts 靠 404 + code=NOT_FOUND 判断「后端是旧版本」
  // 并降级到本地演示账号；这里若回 HTML，降级判定就失效了。
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path === '/api' || req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(WEB_DIR, 'index.html'), (err) => (err ? next(err) : undefined));
  });
  console.log(`[backend] 已托管前端静态文件：${WEB_DIR}`);
}

app.use((req, res) => {
  res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: `未实现的接口：${req.method} ${req.path}` } });
});

// ==================== 启动（端口自适应 + 可选自动开浏览器） ====================
// 端口递增之所以安全：前端只请求同源相对路径 /api/...（client.ts 的 API_BASE 为空串），
// 换端口后同源关系不变，Cookie 与所有静态资源都跟着走，不需要任何额外配置。
const START_PORT = Number(process.env.PORT || PORT);
const AUTO_PORT = process.env.KT_AUTO_PORT !== '0';
const HOST = process.env.HOST || '';

function openBrowser(port) {
  const url = `http://127.0.0.1:${port}/`;
  const cmd =
    process.platform === 'win32' ? `start "" "${url}"`
      : process.platform === 'darwin' ? `open "${url}"`
        : `xdg-open "${url}"`;
  try {
    spawn(cmd, { shell: true, detached: true, stdio: 'ignore' }).unref();
  } catch {
    /* 打不开浏览器不影响服务，控制台里也打印了地址 */
  }
}

function listen(port, attempt = 0) {
  const server = app.listen(port, HOST, () => {
    try {
      console.log(`[backend] 用户存储：${initUsers()}`);
    } catch (e) {
      console.warn(`[backend] 用户存储初始化失败（登录不可用）：${e.message}`);
    }
    console.log(`[backend] 服务已启动：http://localhost:${port}（MOCK_DELAY_MS=${MOCK_DELAY_MS}）`);
    if (port !== START_PORT) {
      console.log(`[backend] 注意：${START_PORT} 端口被占用，已自动改用 ${port}，请用上面的地址访问。`);
    }
    console.log('[backend] 已接入真实模块：2号(建图) 4号(定位) 5号(诊断) 6号(教学)；3号(OCR)缺失用文字兜底；失败自动回退 Mock。');
    if (process.env.KT_OPEN_BROWSER === '1') openBrowser(port);
  });

  server.on('error', (err) => {
    if ((err.code === 'EADDRINUSE' || err.code === 'EACCES') && AUTO_PORT && attempt < 10) {
      console.warn(`[backend] 端口 ${port} 不可用（${err.code}），尝试 ${port + 1} …`);
      server.close(() => listen(port + 1, attempt + 1));
      return;
    }
    console.error(`[backend] 启动失败：${err.message}`);
    process.exit(1);
  });
}

listen(START_PORT);
