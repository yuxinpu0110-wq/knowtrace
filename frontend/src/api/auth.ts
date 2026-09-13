// 认证接口封装：登录 / 登出 / 当前用户 / 用户进度存取。
//
// 契约与队友交付的 auth.ts 保持一致（同名导出、同接口路径），他的登录 UI 交付后可直接替换 LoginView。
// 安全（docs/08）：
// - 真实登录走后端 `/api/auth/login`，密码在后端 scrypt 校验，凭据只经 httpOnly Cookie 传输；
//   前端**不保存任何令牌**，localStorage 里只有展示用的用户名/昵称/角色。
// - 仅当后端不可用时，才退化为前端演示账号兜底（DEMO_USERS），此时才在 localStorage 存一个本地标记 token。
import { apiPost, ApiCallError } from './client';
import type { GraphData, KnowledgeGraphRecord } from '../types';

export interface AuthUser {
  username: string;
  role: string;
  displayName: string;
  /** 仅后端不可用的本地兜底模式才有值；真实登录时为空（凭据在 httpOnly Cookie 里）。 */
  token: string;
}

export interface UserProgress {
  username: string;
  textbook: string;
  graph: GraphData | null;
  masteredIds: string[];
  retainedWeakIds?: string[];
  knowledgeGraphs?: KnowledgeGraphRecord[];
  activeGraphId?: string;
  updatedAt?: string;
  // 以下为队友版本的遗留可选字段，保留以兼容其 UI 代码
  seedIds?: string[];
  suspectedGapId?: string | null;
  step?: number;
}

const USER_KEY = 'knowtrace_user';
const TOKEN_KEY = 'knowtrace_token';
const progressKey = (username: string) => `knowtrace_progress_${username}`;

// 后端是否不可用（网络层失败、或后端是旧版本没有这些接口时才置位；401 密码错误不会置位）
let backendDown = false;
let backendNotice: string | null = null;

export function isBackendDown() {
  return backendDown;
}

/** 降级原因，供登录页提示用户（例如「后端为旧版本，需要重启」）。 */
export function getBackendNotice() {
  return backendNotice;
}

function degrade(reason: string) {
  if (!backendDown) console.warn(`[auth] ${reason}，退化为本地演示登录 + 本地进度存储`);
  backendDown = true;
  backendNotice = reason;
}

// 可降级的失败：网络不通/超时，或后端没有该接口（404 NOT_FOUND，通常是后端进程没重启）。
// 而 401（密码错）必须原样抛给界面，不能降级 —— 否则等于「密码随便输都能进」。
function isDegradable(e: unknown): boolean {
  const code = (e as ApiCallError)?.code;
  return code === 'NETWORK' || code === 'TIMEOUT' || code === 'NOT_FOUND';
}

function degradeReason(e: unknown): string {
  return (e as ApiCallError)?.code === 'NOT_FOUND'
    ? '当前后端为旧版本，未提供登录接口（请重启后端）'
    : '后端不可用';
}

// 演示账号：仅用于后端不可用时的兜底登录（用户已确认保留此兜底）。
const DEMO_USERS: Record<string, { password: string; displayName: string; role: string }> = {
  admin: { password: 'admin', displayName: '超级管理员', role: 'super' },
  Yuxinpu0110: { password: 'abcde0110', displayName: 'Yuxinpu', role: 'user' },
  Xgyr0613: { password: 'tsy0821', displayName: 'Xgyr', role: 'user' },
  Tujuanjuan: { password: 'Lyx0623', displayName: 'Tujuanjuan', role: 'user' },
  WenZhaobo0220: { password: '303603', displayName: 'WenZhaobo', role: 'user' },
  liuhan666: { password: 'liuhan666', displayName: 'liuhan', role: 'user' },
  An1031: { password: '311007', displayName: 'An', role: 'user' },
};

export const DEMO_ACCOUNT_HINTS = Object.keys(DEMO_USERS);

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser | null) {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      // 只在本地兜底模式下存 token；真实登录的凭据是不可读的 httpOnly Cookie
      if (user.token) localStorage.setItem(TOKEN_KEY, user.token);
      else localStorage.removeItem(TOKEN_KEY);
    } else {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* 隐私模式下 localStorage 可能不可用，忽略 */
  }
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const name = username.trim();
  if (!backendDown) {
    try {
      const env = await apiPost<{ username: string; role: string; displayName: string }>(
        '/api/auth/login',
        { username: name, password },
      );
      if (env.ok && env.data) {
        return {
          username: env.data.username ?? name,
          role: env.data.role ?? 'user',
          displayName: env.data.displayName ?? name,
          token: '',
        };
      }
      throw new Error(env.error?.message ?? '登录失败');
    } catch (e) {
      if (!isDegradable(e)) throw e; // 401 账号密码错误等：原样抛给界面
      degrade(degradeReason(e));
    }
  }

  const found = DEMO_USERS[name];
  if (!found || found.password !== password) throw new Error('账号或密码错误');
  return { username: name, role: found.role, displayName: found.displayName, token: `local-${name}-${Date.now()}` };
}

export async function register(username: string, password: string, displayName: string): Promise<AuthUser> {
  if (backendDown) throw new Error('后端不可用，暂不支持注册（请使用演示账号登录）');
  const env = await apiPost<{ username: string; role: string; displayName: string }>('/api/auth/register', {
    username,
    password,
    displayName,
  });
  if (!env.ok || !env.data) throw new Error(env.error?.message ?? '注册失败');
  return {
    username: env.data.username,
    role: env.data.role ?? 'user',
    displayName: env.data.displayName ?? username,
    token: '',
  };
}

export async function logout(): Promise<void> {
  try {
    if (!backendDown) await apiPost('/api/auth/logout', {});
  } catch {
    /* 忽略登出失败：前端仍会清掉本地会话 */
  }
}

/** 校验 Cookie 会话是否仍然有效（刷新页面后恢复登录态用）。 */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  if (backendDown) return getStoredUser();
  try {
    const env = await apiPost<{ username: string; role: string; displayName: string }>('/api/auth/me', {});
    if (env.ok && env.data) {
      return { username: env.data.username, role: env.data.role, displayName: env.data.displayName, token: '' };
    }
    return null;
  } catch (e) {
    if (isDegradable(e)) degrade(degradeReason(e));
    return null;
  }
}

export async function fetchUserProgress(): Promise<UserProgress | null> {
  const user = getStoredUser();
  if (!user) return null;

  if (!backendDown) {
    try {
      const env = await apiPost<UserProgress | null>('/api/user/load-progress', {});
      return env.data ?? null;
    } catch (e) {
      if (isDegradable(e)) degrade(degradeReason(e));
      return null;
    }
  }

  try {
    const raw = localStorage.getItem(progressKey(user.username));
    return raw ? (JSON.parse(raw) as UserProgress) : null;
  } catch {
    return null;
  }
}

export async function saveUserProgress(data: Partial<UserProgress>): Promise<void> {
  const user = getStoredUser();
  if (!user) return;

  if (!backendDown) {
    try {
      await apiPost('/api/user/progress', { progress: data });
      return;
    } catch (e) {
      if (!isDegradable(e)) return; // 400（如数据非法）不重试，也不写本地
      degrade(degradeReason(e));
    }
  }

  try {
    const prev = await fetchUserProgress();
    const merged = { ...(prev ?? {}), ...data, username: user.username };
    localStorage.setItem(progressKey(user.username), JSON.stringify(merged));
  } catch {
    /* 本地保存失败忽略 */
  }
}
