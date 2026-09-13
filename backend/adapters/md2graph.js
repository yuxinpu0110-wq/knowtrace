// 2号模块：Markdown H1-H4 → 知识图谱。本文件是 2.module-2-md2graph/demo/mock_generate_graph.py
// 的逐语义 JS 移植，目的只有一个：让交付版不再依赖 Python。
//
// 移植的正确性标准是「与 Python 参考实现对同一输入产出完全相同的结果」，而不是「看起来一样」。
// 两个容易想当然、实际必须显式对齐的地方：
//   1) 空白字符集与行切分规则：Python 的 \s / str.splitlines() 与 JS 的并不相同
//      （Python 认 \x1c-\x1f、\x85 而 JS 不认；JS 认 ﻿ 而 Python 不认）。
//      直接写 /\s/ 或 split('\n') 会在含换页符/分隔符的教材上悄悄给出不同结果。
//   2) [:180] 是「按码点截断」，JS 的 slice 是「按 UTF-16 码元」，
//      在 emoji 处会截出半个代理对（非法 JSON）。
// 对拍脚本：backend/scripts/parity-md2graph.mjs

// Python str 的空白集合：\s / str.isspace() / str.strip() 三者对 str 而言一致。
const PY_WS =
  '[\\t\\n\\v\\f\\r \\x1c\\x1d\\x1e\\x1f\\x85\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]';

// 注意这些正则都不能带 g 标志（带 g 时 lastIndex 会在多次 exec 之间残留）。
const RE_FENCE = new RegExp('^' + PY_WS + '*(```|~~~)');
const RE_HEADING = new RegExp('^(#{1,6})' + PY_WS + '+(.+?)' + PY_WS + '*$');
const RE_NUMBER = new RegExp('^' + PY_WS + '*\\d+(?:\\.\\d+)*[.、]?' + PY_WS + '*');
const RE_BULLET = new RegExp('^[>*+\\-]' + PY_WS + '*');
const RE_LEAD_WS = new RegExp('^' + PY_WS + '+');
const RE_TAIL_WS = new RegExp(PY_WS + '+$');

const RE_IMAGE = new RegExp('!\\[[^\\]]*\\]\\([^)]*\\)', 'g');
const RE_LINK = new RegExp('\\[([^\\]]+)\\]\\([^)]*\\)', 'g');
const RE_ALL_WS = new RegExp(PY_WS + '+', 'g');

const pyStrip = (s) => s.replace(RE_LEAD_WS, '').replace(RE_TAIL_WS, '');
const pyLStrip = (s) => s.replace(RE_LEAD_WS, '');

// Python str.splitlines() 的断行码点（比 split('\n') 多得多，且 \r\n 只算一个边界）。
const LINE_BOUNDS = new Set([0x0a, 0x0d, 0x0b, 0x0c, 0x1c, 0x1d, 0x1e, 0x85, 0x2028, 0x2029]);

function pySplitlines(text) {
  const out = [];
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const code = text.codePointAt(i);
    if (LINE_BOUNDS.has(code)) {
      out.push(text.slice(start, i));
      if (code === 0x0d && text[i + 1] === '\n') i += 1; // \r\n 视作单个边界
      start = i + 1;
    }
    i += 1;
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}

// 按 Unicode 码点截断，对齐 Python 的切片语义（JS 的 slice 按 UTF-16 码元，会切出半个 emoji）。
const codePointSlice = (s, n) => Array.from(s).slice(0, n).join('');

/** 移除标题里的可选编号，保留知识点名称。 */
function cleanTitle(title) {
  return pyStrip(title.replace(RE_NUMBER, ''));
}

/** 取标题与下一个标题之间的正文，压成一行摘要。 */
function plainSummary(lines) {
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

// ---- 纯 JS SHA-1 ----
// 不用 node:crypto，因为这个文件同时要被前端（单文件版）复用，
// 浏览器里没有 node:crypto。纯 JS 实现在两端产出完全相同的结果。
// 正确性由 parity-md2graph.mjs 的 sha1 用例逐一对照 node:crypto 校验。
function utf8Bytes(str) {
  const out = [];
  for (let i = 0; i < str.length; i += 1) {
    let c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      } else {
        c = 0xfffd; // 孤立高位代理项：标准 UTF-8 编码器会替换成 U+FFFD
      }
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      c = 0xfffd; // 孤立低位代理项同理
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

export function sha1Hex(str) {
  const bytes = utf8Bytes(str);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 4294967296);
  const lo = bitLen >>> 0;
  bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255);
  bytes.push((lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);

  let h0 = 0x67452301; let h1 = 0xefcdab89; let h2 = 0x98badcfe; let h3 = 0x10325476; let h4 = 0xc3d2e1f0;
  const w = new Array(80);

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
      let f; let k;
      if (j < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (j < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const t = ((((a << 5) | (a >>> 27)) + f + e + k + w[j]) | 0);
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }

  const hex = (n) => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h0) + hex(h1) + hex(h2) + hex(h3) + hex(h4);
}

const sha1 = sha1Hex;

function stableId(nodePath, used) {
  const base = 'kp_' + sha1(nodePath.join(' / ')).slice(0, 12);
  let nodeId = base;
  let suffix = 2;
  while (used.has(nodeId)) {
    nodeId = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(nodeId);
  return nodeId;
}

/** 扫描标题行；错误文案与 Python 的 ValueError 逐字一致（前端会直接展示）。 */
export function parseHeadings(markdown) {
  const lines = pySplitlines(markdown);
  const candidates = [];
  let inFence = false;
  let fenceMarker = null;

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

/**
 * Markdown → 知识图谱。校验顺序与 Python 完全一致：
 * 先解析（抛出 H>4 / 空标题），再判空，再判首个必须 H1，最后判跳级。
 */
export function buildGraph(markdown, { nodesOnly = false } = {}) {
  const headings = parseHeadings(markdown);
  if (headings.length === 0) {
    throw new Error('Markdown 中没有找到知识点标题（# 到 ####）');
  }
  if (headings[0].level !== 1) {
    throw new Error(`第一个知识点必须使用一级标题 #，当前是 H${headings[0].level}`);
  }

  const used = new Set();
  const nodes = [];
  const edges = [];
  const stackIds = new Map();
  const stackNames = new Map();

  for (const item of headings) {
    const { level } = item;
    if (level > 1 && !stackIds.has(level - 1)) {
      throw new Error(
        `第 ${item.line} 行标题从上级直接跳到了 H${level}；请先添加 H${level - 1} 母知识点`,
      );
    }

    const nodePath = [];
    for (let i = 1; i < level; i += 1) {
      if (stackNames.has(i)) nodePath.push(stackNames.get(i));
    }
    nodePath.push(item.name);

    const nodeId = stableId(nodePath, used);
    const parentId = stackIds.get(level - 1);

    // 键的书写顺序必须与 Python 的 dict 插入顺序一致（JSON 保序）。
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
    });

    if (parentId && !nodesOnly) {
      edges.push({
        source: parentId,
        target: nodeId,
        relation: 'contains',
        weight: 1.0,
        reason: `Markdown 直接父子层级：H${level - 1} → H${level}`,
      });
    }

    stackIds.set(level, nodeId);
    stackNames.set(level, item.name);
    for (let deeper = level + 1; deeper <= 4; deeper += 1) {
      stackIds.delete(deeper);
      stackNames.delete(deeper);
    }
  }

  const rootNames = nodes.filter((node) => node.level === 1).map((node) => node.name);
  return {
    book_id: 'book_' + sha1(rootNames.join(' / ')).slice(0, 10),
    nodes,
    edges,
    generation: {
      nodes: 'markdown_h1_h4',
      relationships: 'direct_parent_child',
      max_depth: 4,
    },
  };
}

/**
 * 等价于 Python 的 json.dump(ensure_ascii=False, indent=2)，**仅供对拍脚本使用**。
 *
 * 生产链路不用它：graph.js 直接返回对象，server.js 再用 res.json() 序列化 ——
 * 这与移植前的行为完全一致（那时也是 Python 落盘 → readFileSync → JSON.parse → res.json）。
 * 唯一差异是 weight 这个浮点字段：Python 写 `1.0`，JS 写 `1`；解析后二者相等。
 */
export function toPythonJson(graph) {
  // 未转义的 `"weight": 1` 只可能来自本文件写出的键（JSON 字符串内的引号必然是 \"），
  // 用户 Markdown 无法伪造出这个字节序列。
  return JSON.stringify(graph, null, 2).replace(/"weight": 1(?=[,\n])/g, '"weight": 1.0');
}
