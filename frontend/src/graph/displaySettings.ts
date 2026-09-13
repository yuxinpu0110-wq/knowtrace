export interface GraphDisplaySettings {
  nodeScale: number;
  labelScale: number;
}

export const GRAPH_DISPLAY_EVENT = 'kt-graph-display-changed';
const STORAGE_KEY = 'knowtrace_graph_display';
const DEFAULTS: GraphDisplaySettings = { nodeScale: 1, labelScale: 1 };

const clamp = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0.6, Math.min(1.8, numeric)) : fallback;
};

export function readGraphDisplaySettings(): GraphDisplaySettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    return {
      nodeScale: clamp(saved.nodeScale, DEFAULTS.nodeScale),
      labelScale: clamp(saved.labelScale, DEFAULTS.labelScale),
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveGraphDisplaySettings(settings: GraphDisplaySettings) {
  const normalized = {
    nodeScale: clamp(settings.nodeScale, DEFAULTS.nodeScale),
    labelScale: clamp(settings.labelScale, DEFAULTS.labelScale),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // 隐私模式下 localStorage 可能不可用，当前页面仍通过事件实时生效。
  }
  window.dispatchEvent(new CustomEvent(GRAPH_DISPLAY_EVENT, { detail: normalized }));
  return normalized;
}
