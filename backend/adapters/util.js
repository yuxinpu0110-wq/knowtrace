// 适配器公共工具：定位各模块脚本路径（不依赖绝对路径，可用 MODULES_ROOT 覆盖）。
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 模块根目录：backend/adapters -> KnowTrace（上两级）。
export const VALIDATION_ROOT = process.env.MODULES_ROOT
  ? path.resolve(process.env.MODULES_ROOT)
  : path.resolve(__dirname, '..', '..');

export const CONTRACTS_DIR = path.resolve(__dirname, '..', '..', 'contracts');

export function runPython(script, args, { input, timeoutMs = 20000, env = {} } = {}) {
  const r = spawnSync('python', [script, ...args], {
    encoding: 'utf8',
    timeout: timeoutMs,
    input,
    env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', ...env },
  });
  if (r.error) throw new Error(`spawn python 失败: ${r.error.message}`);
  if (r.status !== 0) {
    const detail = (r.stderr || r.stdout || '').trim().slice(0, 600);
    throw new Error(detail || `python 退出码 ${r.status}`);
  }
  return r.stdout ?? '';
}

export function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${label} 不是合法 JSON: ${e.message}`);
  }
}
