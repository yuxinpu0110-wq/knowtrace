import type { NodeState } from '../types';
import { brightness, STATE_COLORS } from './lighting';
import { latexToText } from './latexToText';

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

function rgbValues(color: string) {
  if (color.startsWith('#')) {
    return color.match(/[a-f\d]{2}/gi)?.map((value) => parseInt(value, 16)) ?? [0, 0, 0];
  }
  return (color.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
}

function mixHex(from: string, to: string, amount: number) {
  const a = rgbValues(from);
  const b = rgbValues(to);
  const t = clamp01(amount);
  return `rgb(${a.map((value, index) => Math.round(value + (b[index] - value) * t)).join(',')})`;
}

const TINT_COLORS: Record<NodeState, string> = {
  inactive: '#edf2f6',
  question_related: '#e2f0fc',
  suspected_gap: '#ffe6da',
  mastered: '#e5f4eb',
  recommended: '#e9eafb',
};

const HALO_SIZE: Partial<Record<NodeState, number>> = {
  question_related: 25,
  suspected_gap: 34,
  mastered: 17,
  recommended: 21,
};

function rgba(hex: string, alpha: number) {
  const rgb = hex.match(/[a-f\d]{2}/gi)?.map((value) => parseInt(value, 16)) ?? [0, 0, 0];
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${clamp01(alpha)})`;
}

export function nodeRadius(node: { level?: number }, b: number, on: number, nodeScale = 1): number {
  const base = 4.4 + (node.level ?? 1) * 0.72;
  return base * (0.9 + 0.2 * b * on) * nodeScale;
}

/** 全局唯一节点视觉：语义决定色相，强度决定色深、光晕半径和光晕浓度。 */
export function paintNode(
  node: any,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  stateMap: Map<string, NodeState>,
  distanceMap: Map<string, number>,
  intensityMap: Map<string, number>,
  reveal: number,
  seedId: string | null,
  selectedId: string | null = null,
  learningNodeId: string | null = null,
  learningProgress = 0,
  diagnosisFocus = false,
  diagnosisWeakIds: Set<string> = new Set(),
  focusProgress = diagnosisFocus ? 1 : 0,
  nodeScale = 1,
  labelScale = 1,
) {
  const isCurrentWeak = diagnosisWeakIds.has(node.id);
  const storedState = stateMap.get(node.id) ?? 'inactive';
  const state: NodeState = isCurrentWeak ? 'suspected_gap' : storedState;
  const rawIntensity = intensityMap.get(node.id);
  const hasIntensity = rawIntensity !== undefined;
  const d = distanceMap.get(node.id) ?? Infinity;
  const neutral = seedId == null;
  const distanceBrightness = neutral ? 1 : brightness(d);
  const revealAmount = neutral ? 1 : Number.isFinite(d) ? clamp01(reveal - d + 1) : 0;
  const intensity = hasIntensity ? clamp01(rawIntensity) : state === 'inactive' ? distanceBrightness : 0.66;
  // 拉开视觉动态范围：低置信度更克制，高置信度更快进入饱和与大光晕。
  // 仍保持严格单调，因此视觉强弱始终与真实置信度正相关。
  const strength = smooth(clamp01((intensity - 0.1) / 0.82));

  const isLearningNode = learningNodeId === node.id;
  const progress = isLearningNode ? smooth(learningProgress) : 0;
  // 严格串行：前半程只熄灭橙色，后半程才从零点亮绿色。
  const orangeStrength = isLearningNode && progress < 0.5 ? smooth(1 - progress * 2) * strength : 0;
  const greenStrength = isLearningNode && progress > 0.5 ? smooth((progress - 0.5) * 2) : 0;
  const phaseStrength = Math.max(orangeStrength, greenStrength);
  const semanticState: NodeState = isLearningNode
    ? orangeStrength > 0 ? 'suspected_gap' : 'mastered'
    : state;
  const visualStrength = isLearningNode ? phaseStrength : strength;
  const color = mixHex(TINT_COLORS[semanticState], STATE_COLORS[semanticState], visualStrength);

  const focus = diagnosisFocus ? smooth(focusProgress) : 0;
  const returnsToNeutral = diagnosisFocus && !isCurrentWeak && !isLearningNode;
  const neutralColor = mixHex(TINT_COLORS.inactive, STATE_COLORS.inactive, 0.62);
  // 诊断开始时，已有语义色连续回归普通灰色；候选薄弱点不参与这次褪色。
  const displayColor = returnsToNeutral ? mixHex(color, neutralColor, focus) : color;
  const haloStrength = returnsToNeutral ? visualStrength * (1 - focus) : visualStrength;
  const x = node.x ?? 0;
  const y = node.y ?? 0;
  const r = nodeRadius(node, 0.55 + 0.45 * haloStrength, 0.72 + 0.28 * revealAmount, nodeScale)
    * (semanticState === 'suspected_gap' ? 1 + 0.16 * haloStrength : 1);

  // 连续柔光：宽度按屏幕像素换算，缩放图谱时不会膨胀成巨大的同心圆。
  const haloMax = HALO_SIZE[semanticState] ?? 0;
  if (haloMax > 0 && haloStrength > 0.01) {
    const scale = Math.max(0.6, globalScale);
    const haloExtent = (3 + haloMax * haloStrength) / scale;
    const haloScale = semanticState === 'mastered' ? 0.8 : 1;
    const halo = ctx.createRadialGradient(x, y, r * 0.72, x, y, r + haloExtent);
    halo.addColorStop(0, rgba(STATE_COLORS[semanticState], 0.36 * haloStrength * haloScale));
    halo.addColorStop(0.24, rgba(STATE_COLORS[semanticState], 0.25 * haloStrength * haloScale));
    halo.addColorStop(0.58, rgba(STATE_COLORS[semanticState], 0.095 * haloStrength * haloScale));
    halo.addColorStop(1, rgba(STATE_COLORS[semanticState], 0));
    ctx.beginPath();
    ctx.arc(x, y, r + haloExtent, 0, Math.PI * 2);
    ctx.fillStyle = halo;
    ctx.globalAlpha = 1;
    ctx.fill();
  }

  // 节点本体保持扁平：纯色填充，色深只由连续强度控制。
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = displayColor;
  const stateAlpha = state === 'inactive' ? 0.68 + 0.18 * distanceBrightness : 0.78 + 0.22 * visualStrength;
  const nodeAlpha = isLearningNode ? 0.12 + 0.88 * phaseStrength : stateAlpha;
  ctx.globalAlpha = returnsToNeutral ? nodeAlpha + (0.84 - nodeAlpha) * focus : nodeAlpha;
  ctx.fill();
  ctx.globalAlpha = 1;

  // 单层细描边维持边缘清晰，不添加高光、阴影或立体层次。
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1, r - 0.75 / globalScale), 0, Math.PI * 2);
  ctx.strokeStyle = returnsToNeutral
    ? mixHex(STATE_COLORS[semanticState], STATE_COLORS.inactive, focus)
    : rgba(STATE_COLORS[semanticState], 0.3 + 0.24 * visualStrength);
  ctx.lineWidth = 0.9 / globalScale;
  ctx.globalAlpha = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (!diagnosisFocus && selectedId != null && node.id === selectedId) {
    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = displayColor;
    ctx.lineWidth = 1.3 / globalScale;
    ctx.globalAlpha = 0.66;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 标签不再保持固定屏幕字号：缩小时同步收小以减少拥挤，放大时适度增大。
  const safeScale = Math.max(0.2, globalScale);
  const screenFontSize = Math.max(5, Math.min(28, 10.5 * Math.sqrt(safeScale) * labelScale));
  const fontSize = screenFontSize / safeScale;
  ctx.font = `500 ${fontSize}px "Segoe UI", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#29445f';
  const labelAlpha = state === 'inactive' ? 0.62 + 0.2 * revealAmount : 0.78 + 0.2 * visualStrength;
  ctx.globalAlpha = returnsToNeutral ? labelAlpha + (0.72 - labelAlpha) * focus : labelAlpha;
  ctx.fillText(latexToText(node.name ?? node.id), x, y + r + 3 / globalScale);
  ctx.globalAlpha = 1;
}
