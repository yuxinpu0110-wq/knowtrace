// 各接口封装：优先走后端，失败（或用户开启内置 Mock）时降级到前端缓存 Mock。
import { apiPost, ApiCallError } from './client';
import * as mock from './mock';
import { buildGraph } from '../graph/md2graph';
import type {
  Diagnosis,
  DirectAnswer,
  Evaluation,
  GraphData,
  LocateResult,
  RecognizedQuestion,
  SeedNode,
  Teaching,
  TeachingExplanation,
} from '../types';

export interface ApiCtx {
  useMock: boolean; // true = 直接使用前端内置 Mock，不连后端
  fallbackToMock: boolean; // 后端失败时是否自动降级
}

export interface ApiResult<T> {
  data: T;
  mock: boolean; // 是否 Mock 数据
  fallback: boolean; // 是否因后端失败而降级
}

async function call<T>(
  ctx: ApiCtx,
  path: string,
  body: unknown,
  mockFn: () => Promise<T> | T,
): Promise<ApiResult<T>> {
  if (ctx.useMock) {
    return { data: await mockFn(), mock: true, fallback: false };
  }
  try {
    const env = await apiPost<T>(path, body);
    if (env.ok && env.data !== undefined) {
      return { data: env.data, mock: !!env.mock, fallback: false };
    }
    throw new Error(env.error?.message ?? '接口返回异常');
  } catch (e) {
    if (ctx.fallbackToMock) {
      return { data: await mockFn(), mock: true, fallback: true };
    }
    throw e;
  }
}

export async function generateGraph(ctx: ApiCtx, markdown: string): Promise<ApiResult<{ graph: GraphData }>> {
  // 建图必须消费用户实际输入；即使没有后端，也不能用固定示例图替换教材。
  // 单文件版（从 file:// 直接打开）没有后端，此时改用前端本地建图 —— 产出于后端
  // 完全一致：src/graph/md2graph.ts 与 backend/adapters/md2graph.js 是同一套算法，
  // 两者都已对 Python 参考实现做过逐字节对拍。
  const build = (fallback: boolean) => ({ data: { graph: buildGraph(markdown) }, mock: true, fallback });

  if (ctx.useMock) return build(false);
  try {
    const env = await apiPost<{ graph: GraphData }>('/api/graph/generate', { markdown }, 60000, 1);
    if (!env.ok || !env.data) {
      throw new ApiCallError(env.error?.message ?? '建图接口返回异常', env.error?.code ?? 'HTTP_400');
    }
    return { data: env.data, mock: !!env.mock, fallback: false };
  } catch (e) {
    // 只对「后端够不着」的情形降级。教材本身写错（如用了 H5）必须把原始错误抛给用户，
    // 否则会把一个明确的输入错误伪装成"服务不可用"。
    const code = (e as ApiCallError)?.code;
    const unreachable = code === 'NETWORK' || code === 'TIMEOUT' || code === 'NOT_FOUND' || code === 'PARSE_ERROR';
    if (unreachable && ctx.fallbackToMock) return build(true);
    throw e;
  }
}

export function recognize(ctx: ApiCtx, text: string) {
  return call<RecognizedQuestion>(ctx, '/api/question/recognize', { text }, () => mock.mockRecognize(text));
}

export function locate(ctx: ApiCtx, recognized: RecognizedQuestion, graph: GraphData | null) {
  return call<LocateResult>(ctx, '/api/question/locate', { recognized_question: recognized, graph }, () => mock.mockLocate(recognized, graph));
}

export function answerQuestion(ctx: ApiCtx, question: string, graph: GraphData | null, seedNodes: SeedNode[]) {
  return call<DirectAnswer>(
    ctx,
    '/api/question/answer',
    { question, seed_nodes: seedNodes, graph },
    () => mock.mockAnswerQuestion(question, graph, seedNodes),
  );
}

export function diagnosisNext(ctx: ApiCtx, round: number, question: string, answer: string, signal?: string, seedNodes?: SeedNode[], graph?: GraphData | null) {
  return call<Diagnosis>(ctx, '/api/diagnosis/next', { round, question, answer, signal, seed_nodes: seedNodes }, () => mock.mockDiagnosisNext(round, question, seedNodes, graph));
}

// 必须带上 graph：后端 teaching 用的是跨请求共享的 getGraph()，而「直接学习」
// 入口不会经过 graph/generate 或 question/locate，不补这一份后端就没有图谱，
// 会静默跳过 DeepSeek 教学分支、降级成内置占位文案。
export function teachingGenerate(ctx: ApiCtx, nodeId: string, graph?: GraphData | null) {
  return call<Teaching>(ctx, '/api/teaching/generate', { node_id: nodeId, graph }, () => mock.mockTeachingGenerate(nodeId, graph));
}

export function teachingExplain(ctx: ApiCtx, section: string, content: string, attempt: number) {
  return call<TeachingExplanation>(
    ctx,
    '/api/teaching/explain',
    { section, content, attempt },
    () => mock.mockTeachingExplain(section, content, attempt),
  );
}

export function evaluate(ctx: ApiCtx, nodeId: string, answer: string, graph?: GraphData | null) {
  return call<Evaluation>(ctx, '/api/teaching/evaluate', { node_id: nodeId, answer }, () => mock.mockEvaluate(nodeId, answer, graph));
}

// 调试用：界面设置 API Key（绕过 Mock，始终走后端；key 只存后端内存）。
export function setApiKey(apiKey: string) {
  return apiPost<{ source: string; has_key: boolean }>('/api/config/key', { api_key: apiKey });
}
export function getConfigStatus() {
  return apiPost<{ source: string; has_key: boolean }>('/api/config/status', {});
}
