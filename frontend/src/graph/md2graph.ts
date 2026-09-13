// Markdown H1-H4 → 知识图谱（浏览器版）。
//
// 这份逻辑与 backend/adapters/md2graph.js 是同一套算法，逐行对应 —— 后端那份已用
// backend/scripts/parity-md2graph.mjs 对 Python 参考实现做过 57 组逐字节对拍。
// 放在前端是为了让「单文件版」在没有后端时也能建图（这是唯一没有 Mock 兜底的环节）。
//
// 与后端版的唯一差别：这里不带 toPythonJson（对拍专用），并且 sha1 用同一份纯 JS 实现
// （node:crypto 在浏览器里不存在）。改动这里时，务必同步改后端那份并重跑对拍。

import type { GraphData, GraphNode, GraphEdge } from '../types';

// Python str 的空白集合：\s / str.isspace() / str.strip() 三者对 str 而言一致。
const PY_WS =
  '[\\t\\n\\v\\f\\r \\x1c\\x1d\\x1e\\x1f\\x85\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]';

const RE_FENCE = new RegExp('^' + PY_WS + '*(```|~~~)');
const RE_HEADING = new RegExp('^(#{1,6})' + PY_WS + '+(.+?)' + PY_WS + '*$');
const RE_NUMBER = new RegExp('^' + PY_WS + '*\\d+(?:\\.\\d+)*[.、]?' + PY_WS + '*');
const RE_BULLET = new RegExp('^[>*+\\-]' + PY_WS + '*');
const RE_LEAD_WS = new RegExp('^' + PY_WS + '+');
const RE_TAIL_WS = new RegExp(PY_WS + '+$');

const RE_IMAGE = new RegExp('!\\[[^\\]]*\\]\\([^)]*\\)', 'g');
const RE_LINK = new RegExp('\\[([^\\]]+)\\]\\([^)]*\\)', 'g');
const RE_ALL_WS = new RegExp(PY_WS + '+', 'g');

const pyStrip = (s: string) => s.replace(RE_LEAD_WS, '').replace(RE_TAIL_WS, '');
const pyLStrip = (s: string) => s.replace(RE_LEAD_WS, '');

// Python str.splitlines() 的断行码点（比 split('\n') 多得多，且 \r\n 只算一个边界）。
const LINE_BOUNDS = new Set([0x0a, 0x0d, 0x0b, 0x0c, 0x1c, 0x1d, 0x1e, 0x85, 0x2028, 0x2029]);

function pySplitlines(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const code = text.codePointAt(i) as number;
    if (LINE_BOUNDS.has(code)) {
      out.push(text.slice(start, i));
      if (code === 0x0d && text[i + 1] === '\n') i += 1;
      start = i + 1;
    }
    i += 1;
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}

// 按 Unicode 码点截断，对齐 Python 的切片语义。
const codePointSlice = (s: string, n: number) => Array.from(s).slice(0, n).join('');

// ---- 纯 JS SHA-1（与后端那份逐行一致） ----
function utf8Bytes(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i += 1) {
    let c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      } else {
        c = 0xfffd;
      }
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      c = 0xfffd;
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

export function sha1Hex(str: string): string {
  const bytes = utf8Bytes(str);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 4294967296);
  const lo = bitLen >>> 0;
  bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255);
  bytes.push((lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);

  let h0 = 0x67452301; let h1 = 0xefcdab89; let h2 = 0x98badcfe; let h3 = 0x10325476; let h4 = 0xc3d2e1f0;
  const w = new Array<number>(80);

  for (let i = 0; i < bytes.length; i += 64) {
    for (let j = 0; j < 16; j += 1) {
      w[j] = (bytes[i + j * 4] << 24) | (bytes[i + j * 4 + 1] << 16) | (bytes[i + j * 4 + 2] << 8) | bytes[i + j * 4 + 3];
    }
    for (let j = 16; j < 80; j += 1) {
      const v = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
      w[j] = (v << 1) | (v >>> 31);
    }
    let a = h0; let b = h1; let c = h2; let d = h3; let e = h4;
    for (let j = 0; j < 80; j += 1) {
      let f: number; let k: number;
      if (j < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (j < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const t = ((((a << 5) | (a >>> 27)) + f + e + k + w[j]) | 0);
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }

  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4);
}

function cleanTitle(title: string): string {
  return pyStrip(title.replace(RE_NUMBER, ''));
}

function plainSummary(lines: string[]): string {
  let text = lines
    .filter((line) => pyStrip(line) && !pyLStrip(line).startsWith('#'))
    .map((line) => pyStrip(line))
    .join(' ');
  text = text.replace(RE_IMAGE, '');
  text = text.replace(RE_LINK, '$1');
  text = text.replace(RE_BULLET, '');
  text = text.replace(RE_ALL_WS, ' ');
  return codePointSlice(pyStrip(text), 180);
}

type Candidate = { level: number; raw: string; name: string; line: number; index: number };
type Heading = Candidate & { end: number; summary: string };

export function parseHeadings(markdown: string): Heading[] {
  const lines = pySplitlines(markdown);
  const candidates: Candidate[] = [];
  let inFence = false;
  let fenceMarker: string | null = null;

  lines.forEach((line, index) => {
    const fence = RE_FENCE.exec(line);
    if (fence) {
      const marker = fence[1];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = null;
      }
      return;
    }
    if (inFence) return;

    const match = RE_HEADING.exec(line);
    if (!match) return;
    const level = match[1].length;
    if (level > 4) {
      throw new Error(`第 ${index + 1} 行使用了 H${level}，知识图谱最多支持四层（# 到 ####）`);
    }
    const raw = pyStrip(match[2]);
    const name = cleanTitle(raw);
    if (!name) {
      throw new Error(`第 ${index + 1} 行的标题没有知识点名称`);
    }
    candidates.push({ level, raw, name, line: index + 1, index });
  });

  return candidates.map((item, position) => {
    const end = position + 1 < candidates.length ? candidates[position + 1].index : lines.length;
    return { ...item, end, summary: plainSummary(lines.slice(item.index + 1, end)) };
  });
}

function stableId(nodePath: string[], used: Set<string>): string {
  const base = 'kp_' + sha1Hex(nodePath.join(' / ')).slice(0, 12);
  let nodeId = base;
  let suffix = 2;
  while (used.has(nodeId)) {
    nodeId = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(nodeId);
  return nodeId;
}

export function buildGraph(markdown: string, { nodesOnly = false } = {}): GraphData {
  const headings = parseHeadings(markdown);
  if (headings.length === 0) {
    throw new Error('Markdown 中没有找到知识点标题（# 到 ####）');
  }
  if (headings[0].level !== 1) {
    throw new Error(`第一个知识点必须使用一级标题 #，当前是 H${headings[0].level}`);
  }

  const used = new Set<string>();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const stackIds = new Map<number, string>();
  const stackNames = new Map<number, string>();

  for (const item of headings) {
    const { level } = item;
    if (level > 1 && !stackIds.has(level - 1)) {
      throw new Error(
        `第 ${item.line} 行标题从上级直接跳到了 H${level}；请先添加 H${level - 1} 母知识点`,
      );
    }

    const nodePath: string[] = [];
    for (let i = 1; i < level; i += 1) {
      const n = stackNames.get(i);
      if (n !== undefined) nodePath.push(n);
    }
    nodePath.push(item.name);

    const nodeId = stableId(nodePath, used);
    const parentId = stackIds.get(level - 1);

    nodes.push({
      id: nodeId,
      name: item.name,
      chapter: nodePath[0],
      level,
      summary: item.summary || `${item.name}的核心内容。`,
      keywords: [item.name],
      source: {
        heading: item.raw,
        start_line: item.line,
        end_line: item.end,
      },
    } as GraphNode);

    if (parentId && !nodesOnly) {
      edges.push({
        source: parentId,
        target: nodeId,
        relation: 'contains',
        weight: 1,
        reason: `Markdown 直接父子层级：H${level - 1} → H${level}`,
      } as GraphEdge);
    }

    stackIds.set(level, nodeId);
    stackNames.set(level, item.name);
    for (let deeper = level + 1; deeper <= 4; deeper += 1) {
      stackIds.delete(deeper);
      stackNames.delete(deeper);
    }
  }

  const rootNames = nodes.filter((n) => n.level === 1).map((n) => n.name);
  return {
    book_id: 'book_' + sha1Hex(rootNames.join(' / ')).slice(0, 10),
    nodes,
    edges,
    generation: {
      nodes: 'markdown_h1_h4',
      relationships: 'direct_parent_child',
      max_depth: 4,
    },
  } as unknown as GraphData;
}
