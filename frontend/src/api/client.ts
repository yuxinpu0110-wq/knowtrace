// 统一 API 客户端：超时 + 重试一次 + JSON 解析失败处理 + 结构化错误。
const API_BASE = (import.meta.env.VITE_API_BASE as string) || '';
const TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 12000;

export interface ApiErrorShape {
  code: string;
  message: string;
}

export interface ApiEnvelope<T> {
  ok: boolean;
  mock?: boolean;
  data?: T;
  error?: ApiErrorShape;
}

export class ApiCallError extends Error {
  code: string;
  status?: number;
  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = 'ApiCallError';
    this.code = code;
    this.status = status;
  }
}

async function requestOnce<T>(path: string, body: unknown, signal: AbortSignal): Promise<ApiEnvelope<T>> {
  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal,
      // 会话凭据在 httpOnly Cookie 里，必须带上（同源默认会带；显式声明以防 API_BASE 被配成绝对地址）
      credentials: 'include',
    });
  } catch (e: any) {
    throw new ApiCallError(
      e?.name === 'AbortError' ? '请求超时' : '无法连接后端服务',
      e?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK',
    );
  }

  if (!res.ok) {
    let code = 'HTTP_' + res.status;
    let message = `服务返回 HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) {
        code = j.error.code ?? code;
        message = j.error.message ?? message;
      }
    } catch {
      /* 错误体非 JSON 时忽略 */
    }
    throw new ApiCallError(message, code, res.status);
  }

  try {
    return (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiCallError('响应不是合法 JSON', 'PARSE_ERROR', res.status);
  }
}

// 重试一次：仅对网络错误 / 超时 / 5xx 重试；4xx 与解析失败不重试。
export async function apiPost<T>(path: string, body: unknown, timeoutMs = TIMEOUT_MS, maxAttempts = 2): Promise<ApiEnvelope<T>> {
  let lastErr: ApiCallError | undefined;
  const attempts = Math.max(1, maxAttempts);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await requestOnce<T>(path, body, ctrl.signal);
    } catch (e: any) {
      lastErr = e;
      const retriable =
        e?.code === 'TIMEOUT' || e?.code === 'NETWORK' || (e?.status && e.status >= 500);
      if (attempt + 1 < attempts && retriable) continue;
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr ?? new ApiCallError('未知错误', 'UNKNOWN');
}
