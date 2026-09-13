import type { NodeState } from '../types';

// 状态颜色（AGENTS.md 第 5 节视觉状态）
export const STATE_COLORS: Record<NodeState, string> = {
  inactive: '#9aa9b7', // 雾灰蓝
  question_related: '#287acc', // 海报蓝
  suspected_gap: '#f0642b', // 海报橙
  mastered: '#2fa36b', // 山径绿
  recommended: '#6f73c9', // 柔和靛蓝
};

export const STATE_LABELS: Record<NodeState, string> = {
  inactive: '未激活',
  question_related: '题目相关',
  suspected_gap: '疑似薄弱',
  mastered: '已掌握',
  recommended: '推荐学习',
};

// 建议亮度公式（AGENTS.md 第 8 节）：max(0.15, 1 × 0.72^distance)
// distance 为 Infinity（未激活/超过 3 跳）时仍保持足够可见，诊断强调由独立置信度控制。
export function brightness(distance: number): number {
  if (!Number.isFinite(distance)) return 0.42;
  return Math.max(0.42, Math.pow(0.78, distance));
}
