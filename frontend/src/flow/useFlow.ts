import { useCallback, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
// 示例教材内联导入：单文件版从 file:// 打开时，fetch('/textbook.md') 会被 CORS 拦。
import sampleTextbook from '../assets/textbook.md?raw';
import type {
  Diagnosis,
  DiagnosisOption,
  DirectAnswer,
  Evaluation,
  GraphData,
  GraphNode,
  KnowledgeGraphRecord,
  NodeState,
  RecognizedQuestion,
  SeedNode,
  Teaching,
} from '../types';
import * as api from '../api/api';
import { bfsDistance } from '../graph/bfs';
import { currentRoute, navigate } from '../router';

export interface FlowState {
  activeGraphId: string;
  graphName: string;
  graphLibrary: KnowledgeGraphRecord[];
  textbook: string;
  graph: GraphData | null;
  questionText: string;
  recognized: RecognizedQuestion | null;
  seedNodes: SeedNode[];
  seedId: string | null;
  diagnosisRound: number;
  currentQuestion: string | null;
  currentOptions: DiagnosisOption[] | null;
  diagnosis: Diagnosis | null;
  diagnosisDone: boolean;
  coverageIssue: string | null;
  directAnswer: DirectAnswer | null;
  teachingNodeId: string | null;
  teaching: Teaching | null;
  teachingExtra: string | null;
  confusionCount: number;
  learningProgress: number;
  evaluation: Evaluation | null;
  masteredIds: string[];
  lastLearnedId: string | null;
  retainedWeakIds: string[];
  busy: boolean;
  error: string | null;
  mockMode: boolean;
  degraded: boolean;
  selectedNodeId: string | null;
  /** 首页「直接学习」模式：跳过提问与诊断，点选任一节点即进入 /learn。 */
  directLearn: boolean;
  /** 本次 /learn 是从哪里进来的：'/test'（诊断后学习）或 '/'（首页直接学习）。「返回」据此回退。 */
  learnOrigin: '/' | '/test';
}

const INITIAL: FlowState = {
  activeGraphId: 'graph_default',
  graphName: '知识图谱 1',
  graphLibrary: [{ id: 'graph_default', name: '知识图谱 1', textbook: '', graph: null, masteredIds: [], retainedWeakIds: [] }],
  textbook: '',
  graph: null,
  questionText: '',
  recognized: null,
  seedNodes: [],
  seedId: null,
  diagnosisRound: 0,
  currentQuestion: null,
  currentOptions: null,
  diagnosis: null,
  diagnosisDone: false,
  coverageIssue: null,
  directAnswer: null,
  teachingNodeId: null,
  teaching: null,
  teachingExtra: null,
  confusionCount: 0,
  learningProgress: 0,
  evaluation: null,
  masteredIds: [],
  lastLearnedId: null,
  retainedWeakIds: [],
  busy: false,
  error: null,
  mockMode: false,
  degraded: false,
  selectedNodeId: null,
  directLearn: false,
  learnOrigin: '/',
};

function syncActiveRecord(state: FlowState): KnowledgeGraphRecord[] {
  const active: KnowledgeGraphRecord = {
    id: state.activeGraphId,
    name: state.graphName.trim() || '未命名知识图谱',
    textbook: state.textbook,
    graph: state.graph,
    masteredIds: state.masteredIds,
    retainedWeakIds: state.retainedWeakIds,
  };
  const found = state.graphLibrary.some((item) => item.id === active.id);
  return found
    ? state.graphLibrary.map((item) => item.id === active.id ? active : item)
    : [...state.graphLibrary, active];
}

function loadGraphRecord(state: FlowState, record: KnowledgeGraphRecord, library: KnowledgeGraphRecord[]): FlowState {
  return {
    ...state,
    activeGraphId: record.id,
    graphName: record.name,
    graphLibrary: library,
    textbook: record.textbook,
    graph: record.graph,
    masteredIds: record.masteredIds,
    retainedWeakIds: record.retainedWeakIds,
    questionText: '', recognized: null, seedNodes: [], seedId: null, selectedNodeId: null,
    diagnosisRound: 0, currentQuestion: null, currentOptions: null, diagnosis: null,
    diagnosisDone: false, coverageIssue: null, directAnswer: null, teachingNodeId: null,
    teaching: null, teachingExtra: null, confusionCount: 0, learningProgress: 0,
    evaluation: null, lastLearnedId: null, error: null, degraded: false,
    directLearn: false, learnOrigin: '/',
  };
}

export function useFlow() {
  const [state, setState] = useState<FlowState>(INITIAL);
  const revealRef = useRef(0);

  const graphs = useMemo(
    () => syncActiveRecord(state),
    [state.activeGraphId, state.graphName, state.graphLibrary, state.textbook, state.graph, state.masteredIds, state.retainedWeakIds],
  );

  const ctx = useMemo(
    () => ({ useMock: state.mockMode, fallbackToMock: true }),
    [state.mockMode],
  );

  const patch = useCallback(
    (p: Partial<FlowState> | ((s: FlowState) => Partial<FlowState>)) =>
      setState((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) })),
    [],
  );

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      patch({ busy: true, error: null });
      try {
        await fn();
      } catch (e: any) {
        patch({ error: e?.message ?? '操作失败' });
      } finally {
        patch({ busy: false });
      }
    },
    [patch],
  );

  // ---- 清空本次提问链路（保留图谱与已掌握节点）----
  const resetAskTransient = useCallback(
    () =>
      patch({
        questionText: '',
        recognized: null,
        seedNodes: [],
        seedId: null,
        selectedNodeId: null,
        diagnosisRound: 0,
        currentQuestion: null,
        currentOptions: null,
        diagnosis: null,
        diagnosisDone: false,
        coverageIssue: null,
        directAnswer: null,
        teachingNodeId: null,
        teaching: null,
        teachingExtra: null,
        confusionCount: 0,
        learningProgress: 0,
        evaluation: null,
        lastLearnedId: null,
        error: null,
        directLearn: false,
        learnOrigin: '/',
      }),
    [patch],
  );

  // ---- 导航（路由即环节）----
  const goHome = useCallback(() => { resetAskTransient(); navigate('/'); }, [resetAskTransient]);
  const goEdit = useCallback(() => { patch({ error: null }); navigate('/edit'); }, [patch]);
  const goGraphManager = useCallback(() => { patch({ error: null }); navigate('/graphs'); }, [patch]);
  const goProblem = useCallback(() => { resetAskTransient(); navigate('/problem'); }, [resetAskTransient]);

  // 首页「直接学习」：不清空图谱与已掌握节点，只进入选点态，
  // 之后点图谱任一节点走的是与「诊断后学习」完全相同的 chooseToLearn。
  const goDirectLearn = useCallback(() => {
    resetAskTransient();
    patch({ directLearn: true });
    navigate('/');
  }, [resetAskTransient, patch]);

  const setGraphName = useCallback((name: string) => patch({ graphName: name }), [patch]);

  const saveGraphEdits = useCallback(() => {
    setState((current) => {
      const normalized = { ...current, graphName: current.graphName.trim() || '未命名知识图谱', error: null };
      return { ...normalized, graphLibrary: syncActiveRecord(normalized) };
    });
    navigate('/graphs');
  }, []);

  const switchGraph = useCallback((id: string, destination: '/' | '/graphs' | '/edit' = '/graphs') => {
    const library = syncActiveRecord(state);
    const target = library.find((item) => item.id === id);
    if (!target) return;
    if (id === state.activeGraphId) {
      navigate(destination);
      return;
    }
    const fromIndex = library.findIndex((item) => item.id === state.activeGraphId);
    const toIndex = library.findIndex((item) => item.id === id);
    const direction = toIndex < fromIndex ? 'previous' : 'next';
    document.documentElement.dataset.graphDirection = direction;
    const commit = () => {
      flushSync(() => setState((current) => loadGraphRecord(current, target, library)));
      navigate(destination);
    };
    const startViewTransition = (document as any).startViewTransition?.bind(document);
    if (startViewTransition) {
      const transition = startViewTransition(commit);
      transition.finished.finally(() => { delete document.documentElement.dataset.graphDirection; });
    } else {
      commit();
      window.setTimeout(() => { delete document.documentElement.dataset.graphDirection; }, 550);
    }
  }, [state]);

  const addGraph = useCallback(() => {
    const library = syncActiveRecord(state);
    let number = library.length + 1;
    let name = `知识图谱 ${number}`;
    while (library.some((item) => item.name === name)) name = `知识图谱 ${++number}`;
    const record: KnowledgeGraphRecord = {
      id: `graph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name, textbook: '', graph: null, masteredIds: [], retainedWeakIds: [],
    };
    setState((current) => loadGraphRecord(current, record, [...library, record]));
    navigate('/edit');
  }, [state]);

  const deleteActiveGraph = useCallback(() => {
    setState((current) => {
      const library = syncActiveRecord(current);
      if (library.length <= 1) return current;
      const index = library.findIndex((item) => item.id === current.activeGraphId);
      const remaining = library.filter((item) => item.id !== current.activeGraphId);
      const target = remaining[Math.min(Math.max(index, 0), remaining.length - 1)];
      return loadGraphRecord(current, target, remaining);
    });
  }, []);

  // ---- 编辑：导入教材建图 ----
  const setTextbook = useCallback((t: string) => patch({ textbook: t }), [patch]);

  const loadSampleTextbook = useCallback(async () => {
    if (!sampleTextbook) throw new Error('示例教材加载失败');
    patch({ textbook: sampleTextbook });
  }, [patch]);

  const generateGraph = useCallback(async () => {
    await run(async () => {
      if (!state.textbook.trim()) throw new Error('请先粘贴教材 Markdown');
      const r = await api.generateGraph(ctx, state.textbook);
      patch({ graph: r.data.graph, degraded: r.fallback });
    });
  }, [run, ctx, state.textbook, patch]);

  // ---- 提问：定位 + 诊断（提交后自动进入 /test）----
  const setQuestionText = useCallback((t: string) => patch({
    questionText: t,
    coverageIssue: null,
    directAnswer: null,
    seedNodes: [],
    seedId: null,
    selectedNodeId: null,
    diagnosis: null,
    diagnosisDone: false,
  }), [patch]);

  const submitQuestion = useCallback(async () => {
    const text = state.questionText.trim();
    if (!text) return;
    await run(async () => {
      patch({
        diagnosisDone: false, diagnosis: null, currentQuestion: null, currentOptions: null, coverageIssue: null, directAnswer: null,
        seedNodes: [], seedId: null, teachingNodeId: null, teaching: null, evaluation: null,
      });
      const rec = await api.recognize(ctx, text);
      patch({ recognized: rec.data, degraded: rec.fallback });
      if (isClearlyOutOfScope(rec.data.problem_markdown || text, state.graph)) {
        patch({
          coverageIssue: state.graph
            ? '该问题未命中当前教材中的任何知识点或关键词。'
            : '当前还没有教材知识图谱，请先导入教材后再提问。',
          seedNodes: [], seedId: null, selectedNodeId: null, directAnswer: null,
        });
        return;
      }
      const r = await api.locate(ctx, rec.data, state.graph);
      const nodes = r.data.seed_nodes ?? [];
      if (r.data.in_scope === false || nodes.length === 0) {
        patch({
          seedNodes: [],
          seedId: null,
          selectedNodeId: null,
          coverageIssue: r.data.coverage_reason || '这个问题超出了当前教材知识库的覆盖范围。',
          directAnswer: null,
          degraded: rec.fallback || r.fallback,
        });
        return;
      }
      const seed = nodes[0]?.node_id ?? null;
      patch({ seedNodes: nodes, seedId: seed, selectedNodeId: seed, degraded: rec.fallback || r.fallback });
      revealRef.current = 0;
      const answer = await api.answerQuestion(ctx, rec.data.problem_markdown || text, state.graph, nodes);
      patch({
        directAnswer: answer.data,
        degraded: rec.fallback || r.fallback || answer.fallback,
      });
    });
  }, [run, ctx, state.questionText, state.graph, patch]);

  const startDiagnosis = useCallback(async () => {
    if (!state.directAnswer || !state.seedNodes.length) return;
    navigate('/test');
    await run(async () => {
      const q = state.recognized?.problem_markdown || state.questionText || '题目';
      const d = await api.diagnosisNext(ctx, 0, q, '', undefined, state.seedNodes, state.graph);
      patch({
        diagnosis: d.data,
        diagnosisRound: 0,
        currentQuestion: d.data.next_question ?? null,
        currentOptions: d.data.next_options ?? null,
        degraded: d.fallback,
      });
    });
  }, [run, ctx, state.directAnswer, state.seedNodes, state.recognized, state.questionText, state.graph, patch]);

  const answerDiagnosis = useCallback(
    async (answer: string, signal?: string) => {
      await run(async () => {
        const q = state.recognized?.problem_markdown || state.questionText || '题目';
        const nextRound = state.diagnosisRound + 1;
        const r = await api.diagnosisNext(ctx, nextRound, q, answer, signal, state.seedNodes, state.graph);
        const d = r.data;
        if (d.done) {
          patch((s) => {
            const confirmedWeak = (d.weak_points ?? []).map((point) => point.node_id);
            const weakSet = new Set(confirmedWeak);
            return {
              diagnosis: d,
              diagnosisRound: nextRound,
              currentOptions: null,
              diagnosisDone: true,
              degraded: r.fallback,
              retainedWeakIds: [...new Set([...s.retainedWeakIds, ...confirmedWeak])],
              masteredIds: s.masteredIds.filter((id) => !weakSet.has(id)),
            };
          });
        } else {
          patch({
            diagnosis: d,
            diagnosisRound: nextRound,
            currentQuestion: d.next_question ?? null,
            currentOptions: d.next_options ?? null,
            degraded: r.fallback,
          });
        }
      });
    },
    [run, ctx, state.recognized, state.questionText, state.diagnosisRound, state.seedNodes, state.graph, patch],
  );

  // ---- 学习：点选节点 -> 进入 /learn -> 教学 -> 验证 ----
  const chooseToLearn = useCallback(
    async (nodeId: string) => {
      // 记住入口（/test 诊断后 或 / 首页直接学习），供「返回」正确回退。
      patch({
        selectedNodeId: nodeId, teachingNodeId: nodeId, teachingExtra: null, confusionCount: 0,
        learningProgress: 0, evaluation: null, error: null, directLearn: false,
        learnOrigin: currentRoute() === '/test' ? '/test' : '/',
      });
      navigate('/learn');
      await run(async () => {
        const r = await api.teachingGenerate(ctx, nodeId, state.graph);
        patch({ teaching: r.data, degraded: r.fallback });
      });
    },
    [run, ctx, state.graph, patch],
  );

  const evaluateAnswer = useCallback(
    async (answer: string) => {
      await run(async () => {
        const id = state.teachingNodeId;
        if (!id) throw new Error('缺少学习节点');
        const r = await api.evaluate(ctx, id, answer, state.graph);
        const ev = r.data;
        const mastered = ev.suggested_state === 'green';
        patch((s) =>
          mastered
            ? {
                evaluation: ev,
                degraded: r.fallback,
                masteredIds: [...new Set([...s.masteredIds, id])],
                retainedWeakIds: s.retainedWeakIds.filter((weakId) => weakId !== id),
                lastLearnedId: id,
                learningProgress: 1,
              }
            : {
                evaluation: ev,
                degraded: r.fallback,
                retainedWeakIds: [...new Set([...s.retainedWeakIds, id])],
                masteredIds: s.masteredIds.filter((masteredId) => masteredId !== id),
                learningProgress: 0,
              },
        );
      });
    },
    [run, ctx, state.teachingNodeId, state.graph, patch],
  );

  const retryLearning = useCallback(() => patch({ evaluation: null, error: null }), [patch]);

  const setLearningProgress = useCallback((value: number) => patch({ learningProgress: clamp01(value) }), [patch]);

  const explainSimpler = useCallback(async (section: string, content: string) => {
    await run(async () => {
      const attempt = state.confusionCount + 1;
      const r = await api.teachingExplain(ctx, section, content, attempt);
      patch({
        teachingExtra: r.data.explanation_markdown,
        confusionCount: attempt,
        degraded: r.fallback,
      });
    });
  }, [run, ctx, state.confusionCount, patch]);

  const clearSimplerExplanation = useCallback(() => patch({ teachingExtra: null, confusionCount: 0 }), [patch]);

  const exitLearning = useCallback(() => {
    patch((s) => ({
      questionText: '', recognized: null, seedNodes: [], seedId: null, selectedNodeId: null,
      diagnosisRound: 0, currentQuestion: null, currentOptions: null, diagnosis: null,
      diagnosisDone: false, coverageIssue: null, teachingNodeId: null, teaching: null,
      evaluation: null, directAnswer: null, teachingExtra: null, confusionCount: 0,
      learningProgress: 0, lastLearnedId: null, error: null,
      retainedWeakIds: s.teachingNodeId
        ? [...new Set([...s.retainedWeakIds, s.teachingNodeId])]
        : s.retainedWeakIds,
      masteredIds: s.teachingNodeId
        ? s.masteredIds.filter((id) => id !== s.teachingNodeId)
        : s.masteredIds,
    }));
    navigate('/');
  }, [patch]);

  // 「返回」从 /learn 回退到本次学习的入口：诊断后学习回 /test（沿用原逻辑），
  // 首页直接学习回 /。直接学习是一次性选点态（chooseToLearn 已置回 false），
  // 因此这里落到的是普通首页，与「退出学习」「学完返回」的落点一致。
  const backFromLearn = useCallback(() => {
    if (state.learnOrigin === '/test') {
      navigate('/test');
      return;
    }
    patch({
      teachingNodeId: null, teaching: null, teachingExtra: null, confusionCount: 0,
      learningProgress: 0, evaluation: null, lastLearnedId: null, selectedNodeId: null, error: null,
    });
    navigate('/');
  }, [state.learnOrigin, patch]);

  // ---- 编辑：手动节点状态（普通 / 薄弱 / 已掌握三态互斥）----
  const addNode = useCallback((d: { name: string; chapter?: string; summary?: string }) => {
    setState((s) => {
      if (!s.graph) return s;
      const id = genNodeId(d.name, s.graph.nodes);
      const node: GraphNode = {
        id,
        name: d.name.trim() || id,
        chapter: (d.chapter || '').trim() || '未分类',
        level: 1,
        summary: (d.summary || '').trim(),
        keywords: [],
        source: { heading: '手动添加', start_line: 0, end_line: 0 },
      };
      return { ...s, graph: { ...s.graph, nodes: [...s.graph.nodes, node] } };
    });
  }, []);

  const removeNode = useCallback((id: string) => {
    setState((s) => {
      if (!s.graph) return s;
      return {
        ...s,
        graph: {
          ...s.graph,
          nodes: s.graph.nodes.filter((n) => n.id !== id),
          edges: s.graph.edges.filter((e) => e.source !== id && e.target !== id),
        },
        selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
        masteredIds: s.masteredIds.filter((m) => m !== id),
        retainedWeakIds: s.retainedWeakIds.filter((weakId) => weakId !== id),
      };
    });
  }, []);

  const setNodeStatus = useCallback((id: string, status: 'normal' | 'weak' | 'mastered') => {
    setState((s) => ({
      ...s,
      masteredIds: status === 'mastered'
        ? [...new Set([...s.masteredIds.filter((m) => m !== id), id])]
        : s.masteredIds.filter((m) => m !== id),
      retainedWeakIds: status === 'weak'
        ? [...new Set([...s.retainedWeakIds.filter((weakId) => weakId !== id), id])]
        : s.retainedWeakIds.filter((weakId) => weakId !== id),
      diagnosis: s.diagnosis?.weak_points?.some((point) => point.node_id === id)
        ? { ...s.diagnosis, weak_points: s.diagnosis.weak_points.filter((point) => point.node_id !== id) }
        : s.diagnosis,
    }));
  }, []);

  const selectNode = useCallback((id: string) => patch({ selectedNodeId: id }), [patch]);
  const toggleMockMode = useCallback(() => patch({ mockMode: !state.mockMode, degraded: false }), [patch, state.mockMode]);
  const reset = useCallback(() => { setState(INITIAL); navigate('/'); }, []);

  // 登录后把该用户已保存的图谱/已掌握节点灌入状态（用户信息存储系统）。
  const hydrate = useCallback(
    (p: {
      textbook?: string; graph?: GraphData | null; masteredIds?: string[]; retainedWeakIds?: string[];
      knowledgeGraphs?: KnowledgeGraphRecord[]; activeGraphId?: string;
    }) => {
      setState((s) => {
        const valid = (p.knowledgeGraphs ?? [])
          .filter((item) => item?.id && item?.name)
          .map((item) => ({
            ...item,
            textbook: item.textbook ?? '',
            graph: item.graph ?? null,
            masteredIds: item.masteredIds ?? [],
            retainedWeakIds: item.retainedWeakIds ?? [],
          }));
        const library: KnowledgeGraphRecord[] = valid.length ? valid : [{
          id: 'graph_default', name: '知识图谱 1', textbook: p.textbook ?? '', graph: p.graph ?? null,
          masteredIds: p.masteredIds ?? [], retainedWeakIds: p.retainedWeakIds ?? [],
        }];
        const active = library.find((item) => item.id === p.activeGraphId) ?? library[0];
        return loadGraphRecord(s, active, library);
      });
    },
    [],
  );

  // 推导图谱视觉状态（复用 1号逻辑）
  const stateMap = useMemo(() => {
    const m = new Map<string, NodeState>();
    state.seedNodes.forEach((s) => m.set(s.node_id, 'question_related'));
    if (state.teachingNodeId) m.set(state.teachingNodeId, 'question_related');
    state.retainedWeakIds.forEach((id) => m.set(id, 'suspected_gap'));
    state.masteredIds.forEach((id) => m.set(id, 'mastered'));
    // 当前诊断结论优先级最高，不能被历史“已掌握”覆盖。
    for (const w of state.diagnosis?.weak_points ?? []) m.set(w.node_id, 'suspected_gap');
    return m;
  }, [state.seedNodes, state.diagnosis, state.teachingNodeId, state.retainedWeakIds, state.masteredIds]);

  const distanceMap = useMemo(() => {
    if (!state.graph || !state.seedId) return new Map<string, number>();
    return bfsDistance(state.graph, state.seedId);
  }, [state.graph, state.seedId]);

  // 三种语义色统一映射连续亮度：蓝=relevance，橙=诊断 confidence，绿=掌握 score。
  const intensityMap = useMemo(() => {
    const m = new Map<string, number>();
    const seeds = state.seedNodes;
    if (seeds.length) {
      const maxRel = Math.max(...seeds.map((s) => s.relevance ?? 0), 0.0001);
      for (const s of seeds) {
        const relativeRelevance = clamp01((s.relevance ?? 0) / maxRel);
        m.set(s.node_id, 0.08 + 0.84 * relativeRelevance);
      }
    }
    const weakPoints = state.diagnosis?.weak_points ?? [];
    if (weakPoints.length) {
      for (const point of weakPoints) {
        // 不做同轮相对拉伸：颜色深度与光晕范围直接对应真实置信度。
        m.set(point.node_id, clamp01(point.confidence));
      }
    }
    state.retainedWeakIds.forEach((id) => {
      if (!m.has(id)) m.set(id, 0.82);
    });
    state.masteredIds.forEach((id) => {
      if (!m.has(id)) {
        const score = state.evaluation?.node_id === id ? state.evaluation.score : 0.68;
        m.set(id, clamp01(score));
      }
    });
    return m;
  }, [state.seedNodes, state.diagnosis, state.retainedWeakIds, state.masteredIds, state.evaluation]);

  return {
    state,
    graphs,
    ctx,
    revealRef,
    stateMap,
    distanceMap,
    intensityMap,
    actions: {
      goHome,
      goEdit,
      goGraphManager,
      goProblem,
      goDirectLearn,
      setGraphName,
      saveGraphEdits,
      switchGraph,
      addGraph,
      deleteActiveGraph,
      setTextbook,
      loadSampleTextbook,
      generateGraph,
      setQuestionText,
      submitQuestion,
      answerDiagnosis,
      startDiagnosis,
      chooseToLearn,
      evaluateAnswer,
      retryLearning,
      backFromLearn,
      exitLearning,
      setLearningProgress,
      explainSimpler,
      clearSimplerExplanation,
      addNode,
      removeNode,
      setNodeStatus,
      selectNode,
      toggleMockMode,
      reset,
      hydrate,
    },
  };
}

export type Flow = ReturnType<typeof useFlow>;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function genNodeId(name: string, nodes: GraphNode[]): string {
  const base =
    (name || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'node';
  let id = base;
  let i = 1;
  while (nodes.some((n) => n.id === id)) id = `${base}_${i++}`;
  return id;
}

function isClearlyOutOfScope(question: string, graph: GraphData | null): boolean {
  if (!graph?.nodes.length) return true;
  if (looksLikeDerivative(question)) return false;
  const norm = (text: string) => text.toLowerCase().replace(/[\s`$\\{}()[\],，。！？、:：;；'"“”‘’]/g, '');
  const q = norm(question);
  if (q.length > 10) return false;
  return !graph.nodes.some((node) => [node.name, ...(node.keywords ?? [])]
    .map(norm)
    .filter((term) => term.length >= 2)
    .some((term) => q.includes(term)));
}

function looksLikeDerivative(question: string): boolean {
  return /导数|求导|d\s*\\over\s*\{?d?x|\\frac\s*\{?d|\bd\s*\/\s*d?x\b|\bd\s*[a-z]?\s*\/\s*d?x\b/i.test(question);
}
