// 建图移植的等价性对拍：同一份 Markdown 分别交给 Python 参考实现和 JS 版，
// 逐字节比对输出，并比对错误路径的文案。
//
// 用法：node backend/scripts/parity-md2graph.mjs
// 退出码 0 = 全部一致；1 = 有差异（会打印首个差异位置与两侧窗口）。
// 需要本机有 python；交付包运行时不依赖它，这个脚本只是「移植正确性」的证据。

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildGraph, toPythonJson, sha1Hex } from '../adapters/md2graph.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PY_SCRIPT = path.join(ROOT, '2.module-2-md2graph', 'demo', 'mock_generate_graph.py');

// ---------------- 语料 ----------------

const REAL_FILES = [
  'samples/textbook.md',
  'docs/线性代数知识集合.md',
  'docs/微积分知识集合.md',
  'docs/军事理论知识集合.md',
];

// 专门针对「看起来一样、其实不一样」的坑构造的用例。
// 每一项都对应 Python 与 JS 语义的某个真实分歧点。
const SYNTHETIC = {
  // —— 正常路径 ——
  最小合法输入: '# 根\n\n根的内容。\n\n## 子\n\n子的内容。\n',
  三层四层: '# 一\n\n## 二\n\n### 三\n\n#### 四\n\n深层内容。\n',
  '同级兄弟（触发 id _2 后缀）': '# 根\n\n## 同名\n\na\n\n## 同名\n\nb\n',
  '多棵 H1 根（book_id 拼接）': '# 甲\n\na\n\n# 乙\n\nb\n',
  编号清理: '# 1 第一章\n\n## 1.2.3 导数\n\n## 1.2.3.4.5 深\n',
  中文顿号编号: '# 一、标题\n\n## 二、子标题\n',
  '无正文（摘要回退）': '# 根\n\n## 子\n',

  // —— 围栏 ——
  围栏内标题应忽略: '# 根\n\n```\n# 假的\n## 也假的\n```\n\n## 真的\n',
  波浪围栏: '# 根\n\n~~~\n# 假的\n~~~\n\n## 真的\n',
  带语言围栏: '# 根\n\n```python\n# 注释\n```\n\n## 真的\n',
  未闭合围栏: '# 根\n\n```\n# 后面全被吞\n## 也是\n',
  四反引号围栏: '# 根\n\n````\n# 假的\n````\n\n## 真的\n',
  围栏行前导空格: '# 根\n\n   ```\n# 假的\n   ```\n\n## 真的\n',
  不同围栏交叉: '# 根\n\n```\n~~~\n# 仍是围栏内\n```\n\n## 真的\n',

  // —— 行尾 ——
  'CRLF 全文': '# 根\r\n\r\n## 子\r\n\r\n内容\r\n',
  单独CR: '# 根\r\r## 子\r',
  'CRLF 与 LF 混用': '# 根\r\n\n## 子\n\r\n### 深\n',
  结尾无换行: '# 根\n\n## 子',
  空输入: '',
  纯空白: '   \n\t\n  ',

  // —— Python 与 JS 空白语义分歧点 ——
  换页符断行: '# 根\x0c## 子\x0c内容',
  垂直制表符断行: '# 根\x0b## 子',
  文件分隔符断行: '# 根\x1c## 子',
  'NEL 断行': '# 根\x85## 子',
  'U+2028 断行': '# 根 ## 子',
  'U+2029 断行': '# 根 ## 子',
  '标题含 NEL 空白': '#\x85标题',
  '标题含 U+001C 空白': '#\x1c标题',
  '标题含 NBSP': '# 标题',
  标题含全角空格: '#　标题',
  '标题含 BOM 前缀': '﻿# 根\n\n## 子\n',
  摘要含换页符: '# 根\n\n前\x0c后\n\n## 子\n',
  摘要含NEL: '# 根\n\n前\x85后\n\n## 子\n',
  摘要含NBSP: '# 根\n\n前 后\n\n## 子\n',

  // —— 标题边界 ——
  '仅一个井号（应静默跳过）': '#',
  '井号后全空格（应报空标题）': '#   ',
  '七个井号（应静默跳过）': '######## 标题',
  'H5（应报错）': '# 根\n\n##### 太深\n',
  '缩进标题（应静默跳过）': '   # 缩进标题',
  '井号后紧跟文字（应静默跳过）': '#1.2 标题',
  井号后接制表符: '#\t标题\n',
  标题带尾随空格: '# 标题   \n',
  标题带井号结尾: '# 标题#\n',
  '首个标题是 H2（应报错）': '## 二级打头\n',
  '跳级（应报错）': '# 根\n\n### 跳过二级\n',
  '编号清理后为空（应报错）': '# 1.2.3\n',
  无任何标题: '就是一段普通文字。\n',

  // —— 摘要清洗 ——
  摘要含图片与链接: '# 根\n\n前 ![图](a.png) 中 [链接](b.html) 后\n\n## 子\n',
  摘要含各类列表符号: '# 根\n\n> 引用\n* 星号\n+ 加号\n- 减号\n\n## 子\n',
  摘要含连续空行: '# 根\n\n\n\n前\n\n\n后\n\n\n\n## 子\n',

  // —— 码点截断 ——
  摘要超180字: '# 根\n\n' + '知识'.repeat(120) + '\n\n## 子\n',
  摘要第180位落在emoji: '# 根\n\n' + '知'.repeat(178) + '😀😀😀😀\n\n## 子\n',
  标题含astral字符: '# 根😀\n\n## 子𠮷\n',
};

// ---------------- 执行 ----------------

function runPython(markdown, tmpDir, tag) {
  const inMd = path.join(tmpDir, `${tag}.md`);
  const outJson = path.join(tmpDir, `${tag}.json`);
  writeFileSync(inMd, markdown, 'utf8');
  const r = spawnSync('python', ['-B', PY_SCRIPT, '-i', inMd, '-o', outJson], {
    encoding: 'buffer',
    timeout: 60000,
    // 与 util.js 的 runPython 保持同一组环境变量：不加这两个，Python 会用 Windows
    // 本地编码（GBK）写 stderr，错误文案会变成乱码，对拍就失去意义了。
    env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
  });
  if (r.error) throw new Error(`spawn python 失败：${r.error.message}`);
  const stderr = (r.stderr ?? Buffer.alloc(0)).toString('utf8');
  const stdout = (r.stdout ?? Buffer.alloc(0)).toString('utf8');
  if (r.status !== 0) {
    // util.js 的 runPython 取 stderr 优先、trim 后截断 600 字符
    const detail = (stderr || stdout).trim().slice(0, 600);
    return { ok: false, message: detail };
  }
  return { ok: true, bytes: readFileSync(outJson) };
}

function runJs(markdown) {
  try {
    return { ok: true, bytes: Buffer.from(toPythonJson(buildGraph(markdown)), 'utf8') };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    if (a[i] !== b[i]) return i;
  }
  return a.length === b.length ? -1 : n;
}

// Python 用 open(out, 'w') 的文本模式写文件，Windows 上会把 \n 翻译成 \r\n（os.linesep）；
// JS 的 JSON.stringify 恒为 \n。这是平台写入行为，不是语义差异 —— 生产链路上
// 后端本来就要 JSON.parse 成对象再 res.json()，行尾根本到不了前端。
// 所以比对前统一归一化，避免这层噪声淹没真正的差异。
const normalizeEol = (buf) => Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');

function windowOf(buf, at) {
  const start = Math.max(0, at - 80);
  const end = Math.min(buf.length, at + 80);
  return JSON.stringify(buf.slice(start, end).toString('utf8'));
}

const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'kt-parity-'));
let pass = 0;
let eolOnly = 0;
const failures = [];

function check(label, markdown, tag) {
  const py = runPython(markdown, tmpDir, tag);
  const js = runJs(markdown);

  if (py.ok !== js.ok) {
    failures.push(
      `${label}\n    退出状态不一致：Python ${py.ok ? '成功' : '失败'} / JS ${js.ok ? '成功' : '失败'}\n` +
        `      Python: ${py.message ?? '(成功)'}\n      JS:     ${js.message ?? '(成功)'}`,
    );
    return;
  }
  if (!py.ok) {
    if (py.message !== js.message) {
      failures.push(
        `${label}\n    错误文案不一致：\n      Python: ${JSON.stringify(py.message)}\n      JS:     ${JSON.stringify(js.message)}`,
      );
      return;
    }
    pass += 1;
    return;
  }
  const pyNorm = normalizeEol(py.bytes);
  const jsNorm = normalizeEol(js.bytes);

  if (normalizeEol(py.bytes).equals(jsNorm) === false) {
    const at = firstDiff(pyNorm, jsNorm);
    const semantic = (() => {
      try {
        return (
          JSON.stringify(JSON.parse(pyNorm.toString('utf8'))) ===
          JSON.stringify(JSON.parse(jsNorm.toString('utf8')))
        );
      } catch {
        return false;
      }
    })();
    failures.push(
      `${label}\n    字节差异 @ ${at}（长度 Python=${pyNorm.length} JS=${jsNorm.length}，解析后语义${semantic ? '相同' : '不同'}）\n` +
        `      Python: ${windowOf(pyNorm, at)}\n      JS:     ${windowOf(jsNorm, at)}`,
    );
    return;
  }

  // 归一化后一致：记录原始行尾是否不同（仅统计，不算失败）。
  if (!py.bytes.equals(js.bytes)) eolOnly += 1;
  pass += 1;
}

// ---------------- 纯 JS SHA-1 对照 node:crypto ----------------
// md2graph.js 为了能同时跑在浏览器里，自己实现了 SHA-1。这里把它和 node:crypto
// 逐一对照，覆盖 ASCII、中文、emoji（代理对）、以及会触发多分组/填充边界的长度。
function checkSha1() {
  const crypto = (s) => createHash('sha1').update(Buffer.from(s, 'utf8')).digest('hex');
  const cases = [
    '',
    'a',
    'abc',
    'abcd',
    'The quick brown fox jumps over the lazy dog',
    '线性代数',
    '线性代数 / 线性方程组 / 高斯消元法',
    '😀',
    '主元与自由变量😀𠮷',
    '知'.repeat(55),
    '知'.repeat(56),
    '知'.repeat(57),
    '知'.repeat(64),
    'x'.repeat(119),
    'x'.repeat(120),
    'x'.repeat(1000),
    'a / b / c',
    ' / ',
  ];
  // 再加一批伪随机字符串，覆盖各种长度
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const alphabet = 'abc中文😀𠮷 /·、';
  for (let n = 0; n < 200; n += 1) {
    const len = Math.floor(rnd() * 200);
    let s = '';
    for (let i = 0; i < len; i += 1) {
      s += alphabet[Math.floor(rnd() * alphabet.length)] ?? '';
      if (rnd() > 0.97) s += '😀';
    }
    cases.push(s);
  }

  let bad = 0;
  for (const s of cases) {
    if (sha1Hex(s) !== crypto(s)) {
      bad += 1;
      if (bad <= 3) {
        failures.push(
          `纯 JS SHA-1 与 node:crypto 不一致\n      输入: ${JSON.stringify(s.slice(0, 40))}\n      crypto: ${crypto(s)}\n      自实现: ${sha1Hex(s)}`,
        );
      }
    }
  }
  if (bad === 0) pass += 1;
  console.log(`SHA-1 自实现 vs node:crypto：${cases.length - bad} / ${cases.length} 一致`);
}

try {
  console.log(`Python 参考实现：${PY_SCRIPT}\n`);
  checkSha1();
  console.log('');

  REAL_FILES.forEach((rel, i) => {
    const abs = path.join(ROOT, rel);
    let markdown;
    try {
      markdown = readFileSync(abs, 'utf8');
    } catch {
      console.log(`  跳过（不存在）：${rel}`);
      return;
    }
    check(`真实文件 ${rel}`, markdown, `real-${i}`);
  });

  Object.entries(SYNTHETIC).forEach(([label, markdown], i) => check(label, markdown, `syn-${i}`));

  console.log(`\n通过 ${pass} / ${pass + failures.length}`);
  if (eolOnly) {
    console.log(
      `其中 ${eolOnly} 项原始字节仅在行尾不同（Python 文本模式写 \\r\\n，JS 写 \\n），归一化后完全一致。`,
    );
  }
  if (failures.length) {
    console.log('\n不一致：\n');
    failures.forEach((f) => console.log(`  ✗ ${f}\n`));
    process.exitCode = 1;
  } else {
    console.log('归一化后全部逐字节一致。');
  }
} finally {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
