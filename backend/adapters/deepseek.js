// 服务端 DeepSeek 客户端（OpenAI 兼容）。密钥优先用界面设置（内存），否则读服务器环境变量，绝不回传浏览器。
// 仅用于生成文本内容（题目/选项/教学文案/选节点）；BFS、距离、亮度、颜色、置信度仍在 JS 计算。
import { getApiKey } from './key.js';

const DEFAULT_BASE = 'https://api.deepseek.com/v1';
const DEFAULT_MODEL = 'deepseek-flash';
const TIMEOUT_MS = 30000;

export function hasKey() {
  return Boolean(getApiKey());
}

// 从模型输出中抽取裸 JSON（容忍 markdown 代码块与前后缀文本）。
function extractJson(content) {
  const text = (content || '').trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1].trim() : text;
  const s = body.indexOf('{');
  const e = body.lastIndexOf('}');
  if (s === -1 || e === -1 || e <= s) throw new Error('DeepSeek 输出不是合法 JSON');
  return JSON.parse(body.slice(s, e + 1));
}

export async function chatJson({ system, user, temperature = 0, maxRetries = 1 }) {
  const key = getApiKey();
  if (!key) throw new Error('缺少 DEEPSEEK_API_KEY');
  const base = (process.env.DEEPSEEK_API_BASE || DEFAULT_BASE).replace(/\/+$/, '');
  const model = process.env.DEEPSEEK_MODEL || DEFAULT_MODEL;
  const url = `${base}/chat/completions`;
  const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(TIMEOUT_MS) : undefined;

  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          temperature,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_object' },
        }),
        signal,
      });
      if (!resp.ok) {
        const detail = (await resp.text().catch(() => '')).slice(0, 300);
        throw new Error(`DeepSeek HTTP ${resp.status}: ${detail}`);
      }
      const body = await resp.json();
      const content = body?.choices?.[0]?.message?.content ?? '';
      return extractJson(content);
    } catch (e) {
      lastErr = e;
      if (attempt >= maxRetries) break;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr || new Error('DeepSeek 调用失败');
}
