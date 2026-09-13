# 知溯 KnowTrace

> 从教材自动构建知识图谱，通过提问与多轮诊断定位学生的知识断点，再针对性教学与验证。

一个帮学生找到「卡在哪里」的 AI 工具，而不是又一个答题 App。

**学习产品通常只告诉你「这题错了」；知溯要回答的是「你到底是哪个知识点没懂」。**
它先把教材变成一张有层级的知识图谱，再通过提问与连续追问，把问题收敛到具体节点上，
最后只针对那一个节点做教学与验证——通过了，节点才在图谱上点亮。

## 团队

- **主要开发者**：yunshu-zhang
- **参与者**：tujuanjuan、JobWen0220、Darling-An

---

## 30 秒开始（双击即用，零依赖）

**直接双击根目录的 `知溯KnowTrace.html`**，浏览器打开即进入登录页。

**不需要安装 Node.js、不需要双击任何脚本、不需要联网、不需要 API Key。**
它是一个自包含的单文件：JS、CSS、KaTeX 数学字体全部内联，离线也能完整运行。

用下面的演示账号登录即可：

| 账号 | 密码 | 角色 |
|---|---|---|
| `admin` | `admin` | 超级管理员 |
| `Yuxinpu0110` | `abcde0110` | 用户 |
| `Xgyr0613` | `tsy0821` | 用户 |
| `Tujuanjuan` | `Lyx0623` | 用户 |
| `WenZhaobo0220` | `303603` | 用户 |
| `liuhan666` | `liuhan666` | 用户 |
| `An1031` | `311007` | 用户 |

> 双击打开的是**离线演示模式**：建图、定位、诊断、教学全链路走内置 Mock，三个演示场景完整可跑。
> 想要真实 DeepSeek 大模型生成内容时，用下面「完整后端」的方式启动。

**推荐的完整演示路径**：登录 → 编辑页导入教材建图 → 提问 → 诊断 → 学习 → 验证通过 → 回到首页看节点变绿。

---

## 进阶：完整后端（真实大模型，需 Node.js 18+）

想接真实 DeepSeek、多账号进度落盘时，走单进程后端（会托管同一个前端页面）：

**Windows**：双击 `启动.bat`（或在非英文路径环境下用 `start.bat`）
**macOS / Linux**：`./启动.sh`

浏览器自动打开。端口 3001 被占用时会自动改用 3002/3003…，控制台会打印实际地址。

> **开箱预置**：`Yuxinpu0110`（微积分）与 `Xgyr0613`（军事理论、微积分、线性代数）两个账号首次登录即带已建好的图谱，
> 每个图谱随机点亮十几个节点（绿=已掌握、橙=薄弱），无需现场粘教材即可直接看「提问 → 诊断 → 学习」链路。

---

## 两种运行方式的区别

| | 双击 `知溯KnowTrace.html` | 启动 `启动.bat` |
|---|---|---|
| 需要安装 | **无** | Node.js 18+（[下载](https://nodejs.org/)） |
| 建图 | 纯 JS（与后端同一套算法） | 纯 JS（同一套算法） |
| 定位 / 诊断 / 教学 | 内置 Mock 兜底 | DeepSeek 优先（自填 Key），失败自动回退 Mock |
| 登录 / 进度 | 演示账号，进度存浏览器 localStorage | 演示账号，进度存后端 `store.json` |
| 联网 | 不需要 | 不需要（除非接 API Key） |
| 依赖安装 | 无 | 已内置在 `backend/node_modules`，无需 `npm install` |

两种方式都能走完六个环节；区别只在「大模型实时生成」与「多账号进度落盘」这两点。

---

## 六个环节

| 路由 | 环节 | 做什么 |
|---|---|---|
| `/login` | 登录门禁 | 会话走 httpOnly Cookie，密码只存 scrypt 哈希 |
| `/` | 首页 | 知识图谱可视化；橙色为疑似薄弱点，亮度越高越薄弱；支持「直接学习」跳过诊断 |
| `/edit` | 编辑 | 导入教材 Markdown 建图；管理节点（删除 / 标为已掌握） |
| `/problem` | 提问 | 题目识别 + 定位到相关知识点，并判断是否超出教材覆盖范围 |
| `/test` | 诊断 | 2~5 道选择题连续追问，逐轮收敛薄弱点 |
| `/learn` | 学习 | 单节点六步教学（定义/直觉/联系/示例/易错点/检测）+ 验证，通过后点亮为绿色 |

---

## 演示教材与内置场景

`docs/` 下有三份完整教材，分别对应三个内置 Mock 场景，**现场建图后即可完整走通，不依赖 API Key**：

| 教材 | 规模 | 场景涉及的关键节点 |
|---|---|---|
| `docs/线性代数知识集合.md` | 139 个知识点 | 高斯消元法 / 主元与自由变量 / 行阶梯形与行简化阶梯形 |
| `docs/微积分知识集合.md` | 188 个知识点 | 函数的连续性 / 连续的定义 / 函数极限的定义 |
| `docs/军事理论知识集合.md` | 134 个知识点 | 信息化战争的制胜要素 / 信息化战争的基本特征 |

也可以点编辑页的「载入示例教材」用 `samples/textbook.md` 快速试一次。

---

## 接入真实 DeepSeek（需自填 Key）

后端**不内置任何 Key**（出于安全，代码里不带密钥）。想接真实大模型，二选一：

1. **界面设置（推荐）**：启动后点左下角 ⚙️ 填入 Key。**只存后端内存，不写文件、不回传浏览器**；重启后端即失效，优先级最高。
2. **环境变量**：复制 `.env.example` 为 `.env` 填入 `DEEPSEEK_API_KEY`（`.env` 已被 gitignore，不会入库；启动器会自动加载）。

优先级：界面设置 > 环境变量。两者都不填时后端自动回退内置 Mock，演示链路照常完整可跑。
无论哪种来源，后端都遵循「真实模块优先、失败自动回退 Mock」，单个模块挂掉不会让主链路崩溃。

---

## 技术架构

```
浏览器
  │  同源请求 /api/*（前端 API_BASE 为空串，无跨域）
  ▼
Express 单进程（默认 :3001）
  ├── express.static  → frontend/dist        ← 前端构建产物，含 SPA fallback
  └── /api/*          → 适配器层
                         ├── graph     Markdown H1-H4 → 知识图谱（纯 JS）
                         ├── locate    题目 → 相关节点（DeepSeek 优先，失败回退关键词匹配）
                         ├── diagnosis 多轮诊断
                         ├── teaching  单节点教学 + 验证判分
                         ├── answer    基于教材直接解答
                         └── users     登录鉴权 + 学习进度落盘
```

- **前端**：React 18 + TypeScript + Vite 5，KaTeX 渲染数学公式，`react-force-graph-2d` 绘制图谱。
- **后端**：Express 4（ESM），唯一运行时依赖。
- **交付形态**：① 自包含单文件 HTML（双击即用）；② 单进程单端口后端（一个进程既是 API 也是 Web 服务器）。

### 安全红线

1. **API Key 不出后端**：只从界面或环境变量读取，存后端内存，不回传浏览器、不写文件。
2. **完整 Prompt 与模型原始输出不出浏览器**；BFS 距离、亮度、颜色、置信度一律由前后端 JS 计算，不交给大模型。
3. **不创造图谱中不存在的 `node_id`**；进度里的 `mastered_ids` 由后端强制过滤到图谱真实节点。
4. **密码只存哈希**（scrypt + salt），凭据只经 httpOnly Cookie 传输，前端不保存令牌。
5. `expected_answer` 只存后端 `specCache`，不返回前端。

---

## 与开发版的差异

本交付版基于 `KnowTrace/` 开发版封装，只做了四处改动，均为「让评测者能零依赖跑起来」所必需：

| 改动 | 原因 |
|---|---|
| **单文件 HTML**：`frontend/dist/index.html` 由 `vite-plugin-singlefile` 打成自包含单文件，入口从 ESM 改为经典脚本、挂载延后到 DOM 就绪 | 原构建是 `type="module"` 脚本，file:// 下会被浏览器 CORS 直接拒绝，双击打不开。改后根目录 `知溯KnowTrace.html` 双击即用，绕开「要装 Node」和「被 Smart App Control 拦截 exe」两类问题。 |
| **建图 Python → JS**：`2.module-2-md2graph/demo/mock_generate_graph.py` 移植为 `backend/adapters/md2graph.js` | 原实现每次建图都要 `spawn python`。评测者机器上没有 Python 时，建图会直接失败（该接口是唯一没有 Mock 兜底的环节，其余五个环节都有）。移植后建图变成 <10ms 的纯内存计算，前端 `src/graph/md2graph.ts` 与后端同一套算法，离线也能建图。 |
| **后端托管前端静态文件**：`server.js` 增加 `express.static` + SPA fallback | 交付版要单进程双击即用，不能要求另开 Vite 开发服务器。 |
| **端口自适应 + 自动开浏览器** | 让「双击」这件事真的成立。 |

### 移植的正确性怎么证明

移植的标准是「与 Python 参考实现对同一输入产出完全相同的结果」，而不是「看起来一样」。

```bash
node backend/scripts/parity-md2graph.mjs      # 需要本机有 Python，仅为验证用
```

该脚本把 **57 组输入**（4 份真实教材 + 50 余个边界用例）分别喂给 Python 参考实现和 JS 版，
逐字节比对输出与错误文案。当前结果：

```
通过 57 / 57
其中 42 项原始字节仅在行尾不同（Python 文本模式写 \r\n，JS 写 \n），归一化后完全一致。
归一化后全部逐字节一致。
```

边界用例专门覆盖了 Python 与 JS 语义真正分歧的地方，例如：

- **空白字符集**：Python 的 `\s` 认 `\x1c-\x1f`、`\x85`，JS 不认；JS 认 `﻿`，Python 不认。
- **行切分**：Python `str.splitlines()` 会在 `\v \f \x1c \x1d \x1e \x85    ` 处断行，JS `split('\n')` 不会。
- **码点截断**：Python 的 `[:180]` 按码点截断，JS 的 `slice` 按 UTF-16 码元，在 emoji 处会截出半个代理对。
- **错误文案**：五条校验错误的文字与抛出顺序完全一致。

> 归一化掉的那处行尾差异是平台行为，不是语义差异：Python 用文本模式写文件，Windows 上会把 `\n`
> 翻译成 `\r\n`。生产链路根本不经过文件——后端本来就把结果 `JSON.parse` 成对象再 `res.json()`。

`2.module-2-md2graph/` 目录保留在包内，作为移植的参考实现与出处，**已不再是运行时依赖**。

---

## 目录结构

```
KnowTrace_Finalized/
├── 知溯KnowTrace.html               ← 双击即用（自包含单文件，零依赖）
├── 启动.bat / 启动.sh / start.bat   ← 完整后端入口（需 Node.js 18+）
├── README.md / 使用说明.md
├── backend/                         ← Express 单进程后端
│   ├── server.js                    ← 接口接线 + 静态托管 + 端口自适应
│   ├── adapters/                    ← 各环节适配器（graph/locate/diagnosis/teaching/...）
│   │   └── md2graph.js              ← 建图（Python 移植版）
│   ├── mocks/                       ← 各环节 Mock 兜底
│   ├── scripts/parity-md2graph.mjs  ← 移植等价性对拍
│   ├── node_modules/                ← 已内置（仅 express），无需 npm install
│   └── data/                        ← 运行时生成 store.json，首次启动自动建演示账号
├── frontend/dist/index.html         ← 前端构建产物（与根目录 HTML 同一份）
├── contracts/                       ← 冻结契约（运行时必需：mocks 读 graph.example.json）
├── docs/                            ← 各环节文档 + 三份演示教材
├── samples/                         ← 示例教材
├── resources/                       ← 发布用展示素材（封面图等，可选）
└── 2.module-2-md2graph/             ← 建图的 Python 参考实现（非运行时依赖）
```

---

## 常见问题

**双击 HTML 打不开 / 白屏？** 换个浏览器（建议 Chrome / Edge 最新版）。文件 2.1MB，含内联字体，首次打开稍慢是正常的。

**想用真实大模型？** 装 Node.js 18+ 后双击 `启动.bat`，再点左下角 ⚙️ 填 Key。

**端口被占用？** 自动改用下一个可用端口，控制台会打印实际地址。也可以设 `PORT=8080` 指定。

**浏览器没自动打开？** 手动访问控制台打印的 `http://localhost:<端口>/` 即可（设 `KT_OPEN_BROWSER=0` 可关闭自动打开）。

**登录后刷新掉线？** 会话走 Cookie，请勿禁用浏览器 Cookie。

**想换数据目录或重置演示账号？** 删掉 `backend/data/store.json` 重启即可重置；或用 `KT_DATA_DIR` 指定别处。

**从源码重新构建前端？** `cd frontend && npm install && npm run build`，产物会回到 `frontend/dist/index.html`；再复制一份到根目录覆盖 `知溯KnowTrace.html`。
