import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { GraphData, NodeState } from '../types';
import { paintNode, nodeRadius } from '../graph/paintNode';
import { brightness } from '../graph/lighting';
import { MAX_HOPS } from '../graph/bfs';
import { GRAPH_DISPLAY_EVENT, readGraphDisplaySettings, type GraphDisplaySettings } from '../graph/displaySettings';
import { latexToText } from '../graph/latexToText';

interface Props {
  graph: GraphData;
  stateMap: Map<string, NodeState>;
  distanceMap: Map<string, number>;
  intensityMap: Map<string, number>;
  seedId: string | null;
  selectedId: string | null;
  learningNodeId: string | null;
  learningProgress: number;
  diagnosisFocus: boolean;
  diagnosisWeakIds: string[];
  revealRef: React.MutableRefObject<number>;
  onSelect: (id: string) => void;
}

function useSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export default function GraphPanel({ graph, stateMap, distanceMap, intensityMap, seedId, selectedId, learningNodeId, learningProgress, diagnosisFocus, diagnosisWeakIds, revealRef, onSelect }: Props) {
  const [wrapRef, size] = useSize();
  const [paintFrame, setPaintFrame] = useState(0);
  const [displaySettings, setDisplaySettings] = useState<GraphDisplaySettings>(readGraphDisplaySettings);
  const fgRef = useRef<any>(null);
  const fitOnce = useRef(true);
  const intensityRef = useRef<Map<string, number>>(new Map());
  const previousWeakIdsRef = useRef<Set<string>>(new Set());
  const learningProgressRef = useRef(0);
  const focusProgressRef = useRef(diagnosisFocus ? 1 : 0);
  const diagnosisWeakSet = useMemo(() => new Set(diagnosisWeakIds), [diagnosisWeakIds]);

  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<GraphDisplaySettings>).detail;
      setDisplaySettings(detail ?? readGraphDisplaySettings());
      setPaintFrame((frame) => (frame + 1) % 100000);
    };
    window.addEventListener(GRAPH_DISPLAY_EVENT, update);
    return () => window.removeEventListener(GRAPH_DISPLAY_EVENT, update);
  }, []);

  // 关键：links 必须传副本。react-force-graph 会原地改写传入的 link（把 source/target
  // 从 id 字符串换成节点对象），若共用同一批对象，会污染 state.graph.edges，
  // 导致 BFS 邻接表全空、删节点留下悬空边。nodes 可共享（力的 x/y 写回是有益的）。
  const data = useMemo(
    () => ({ nodes: graph.nodes, links: graph.edges.map((e) => ({ ...e })) }),
    [graph],
  );

  // 神经元式点亮：种子变化时逐层展开，每层 250ms。
  useEffect(() => {
    if (!graph || !seedId) return;
    let maxDist = 0;
    distanceMap.forEach((d) => {
      if (Number.isFinite(d)) maxDist = Math.max(maxDist, Math.min(d, MAX_HOPS));
    });
    const total = maxDist * 250;
    const start = performance.now();
    revealRef.current = 0;
    let raf = 0;
    const step = (now: number) => {
      const t = total > 0 ? Math.min(1, (now - start) / total) : 1;
      revealRef.current = maxDist * t;
      setPaintFrame((frame) => (frame + 1) % 100000);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seedId, distanceMap, graph, revealRef]);

  // 置信度亮度动画：intensityMap 变化时，把各节点亮度从当前值缓动到目标值（薄弱点每轮“越点越亮”）。
  useEffect(() => {
    const from = new Map(intensityRef.current);
    const target = intensityMap;
    const weakIds = diagnosisFocus
      ? diagnosisWeakSet
      : new Set([...stateMap.entries()].filter(([, state]) => state === 'suspected_gap').map(([id]) => id));
    // 新进入薄弱候选的节点从 0 开始平滑着色，避免状态色瞬间跳成橙色。
    weakIds.forEach((id) => {
      if (!previousWeakIdsRef.current.has(id)) from.set(id, 0);
    });
    previousWeakIdsRef.current = weakIds;
    intensityRef.current = from;
    const keys = new Set<string>([...from.keys(), ...target.keys()]);
    if (keys.size === 0) return;
    const start = performance.now();
    const DURATION = 1250;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      // smootherstep：起点和终点速度均为 0，连续多轮更新时不会出现顿挫。
      const eased = t < 1 ? t * t * t * (t * (t * 6 - 15) + 10) : 1;
      const next = new Map<string, number>();
      keys.forEach((k) => {
        const v = (from.get(k) ?? 0) + ((target.get(k) ?? 0) - (from.get(k) ?? 0)) * eased;
        if (v > 0.001) next.set(k, v);
      });
      intensityRef.current = next;
      setPaintFrame((frame) => (frame + 1) % 100000);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [intensityMap, stateMap, diagnosisFocus, diagnosisWeakSet]);

  // 诊断模式也是一个连续量：进入时全图在 1.1 秒内淡出，候选节点同步由原状态过渡到橙色。
  useEffect(() => {
    const from = focusProgressRef.current;
    const to = diagnosisFocus ? 1 : 0;
    const start = performance.now();
    const duration = 1100;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t * t * t * (t * (t * 6 - 15) + 10);
      focusProgressRef.current = from + (to - from) * eased;
      setPaintFrame((frame) => (frame + 1) % 100000);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [diagnosisFocus]);

  useEffect(() => {
    const from = learningProgressRef.current;
    const to = Math.max(0, Math.min(1, learningProgress));
    const start = performance.now();
    const duration = 1250;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t * t * (3 - 2 * t);
      learningProgressRef.current = from + (to - from) * eased;
      setPaintFrame((frame) => (frame + 1) % 100000);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [learningProgress]);

  // Map 的内容变化不会被画布库可靠侦测，因此状态变化后显式刷新。
  useEffect(() => {
    setPaintFrame((frame) => (frame + 1) % 100000);
  }, [stateMap, diagnosisWeakSet, learningNodeId]);

  // 每次关注节点更新后，镜头平滑框选所有有强度的节点。
  useEffect(() => {
    const ids = diagnosisFocus
      ? diagnosisWeakSet
      : new Set([...intensityMap.entries()].filter(([, value]) => value > 0.08).map(([id]) => id));
    if (!ids.size) return;
    const timer = window.setTimeout(() => {
      fgRef.current?.zoomToFit(1100, 115, (node: any) => ids.has(node.id));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [intensityMap, graph, size.w, size.h, diagnosisFocus, diagnosisWeakSet]);

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, gs: number) => {
      paintNode(node, ctx, gs, stateMap, distanceMap, intensityRef.current, revealRef.current, seedId, selectedId, learningNodeId, learningProgressRef.current, diagnosisFocus, diagnosisWeakSet, focusProgressRef.current, displaySettings.nodeScale, displaySettings.labelScale);
    },
    [stateMap, distanceMap, revealRef, seedId, selectedId, learningNodeId, diagnosisFocus, diagnosisWeakSet, displaySettings, paintFrame],
  );

  const nodePointerAreaPaint = useCallback(
    (node: any, color: string, ctx: CanvasRenderingContext2D) => {
      const b = brightness(distanceMap.get(node.id) ?? Infinity);
      const r = nodeRadius(node, b, 1, displaySettings.nodeScale) + 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, Math.PI * 2);
      ctx.fill();
    },
    [distanceMap, displaySettings.nodeScale],
  );

  const linkColor = useCallback(
    (l: any) => {
      const s = l.source?.id ?? l.source;
      const t = l.target?.id ?? l.target;
      if (diagnosisFocus) return 'rgba(126, 146, 165, 0.08)';
      return s === seedId || t === seedId ? 'rgba(40, 122, 204, 0.64)' : 'rgba(126, 146, 165, 0.28)';
    },
    [seedId, diagnosisFocus],
  );

  const handleEngineStop = useCallback(() => {
    if (fitOnce.current) {
      fitOnce.current = false;
      fgRef.current?.zoomToFit(400, 80);
    }
  }, []);

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        width={size.w}
        height={size.h}
        backgroundColor="#f7f9fb"
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkColor={linkColor}
        linkWidth={1}
        nodeLabel={(n: any) => `${latexToText(n.name)}\n${latexToText(n.chapter)} · 层级 ${n.level}\n${latexToText(n.summary)}`}
        onNodeClick={(n: any) => onSelect(n.id)}
        onEngineStop={handleEngineStop}
        cooldownTicks={120}
        d3AlphaDecay={0.05}
        minZoom={0.2}
        maxZoom={8}
        enableZoomInteraction
        enablePanInteraction
      />
    </div>
  );
}
