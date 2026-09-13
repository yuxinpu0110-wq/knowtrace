# 环节 6：设置 / API Key（7号整合，跨环节）

## 这个环节做什么

左下角 ⚙️ 按钮打开设置弹窗，用户可输入 DeepSeek API Key，这样**其他人调试时不需要改后端**。Key 只保存在后端内存，不回传浏览器、不写入文件、优先于环境变量。

## 负责的文件

- `frontend/src/views/SettingsButton.tsx` —— 左下角 FAB + 弹窗。
- `frontend/src/api/api.ts` —— `setApiKey(apiKey)`、`getConfigStatus()`（绕过 Mock，始终走后端）。
- `backend/adapters/key.js` —— 运行时 key 存储（`setApiKey` / `getApiKey` / `hasKey` / `keySource`）。
- `backend/adapters/deepseek.js`、`backend/adapters/graph.js` —— 通过 `getApiKey()` 读取 key。
- `backend/server.js` —— `POST /api/config/key`、`POST /api/config/status`。

## Key 读取优先级（后端 `key.js`）

```
界面设置的 key  >  环境变量 DEEPSEEK_API_KEY  >  无 key
   (overrideKey)          (process.env)            (回退 Mock)
```

- 设置非空 key → `source='ui'`；清空 → 回退环境变量（`source='env'` 或 `none`）。
- 2号 Python 建图脚本通过 `runPython` 的 env 合并拿到 `DEEPSEEK_API_KEY`，无需改脚本。

## 验收清单

1. 左下角有 ⚙️ 按钮，点击弹出设置弹窗。
2. 输入 key → 「保存」→ 状态显示「当前来源：界面设置 · 已配置 Key」。
3. 后端不重启，随后建图/定位/诊断/教学走真实 DeepSeek（后端日志出现 `真实模块完成`）。
4. 清空 key → 「保存」→ 状态显示「当前来源：环境变量/未配置」，链路回退 Mock。
5. 「刷新状态」能从后端拿到当前 `{ source, has_key }`。
6. **浏览器网络面板 / localStorage / 后端返回中，都看不到 key 明文**（只回 `has_key` 布尔 + source）。

## 安全红线（本环节最敏感）

- key 只存后端内存 `key.js`，**不写文件、不回传 key 本身、不进前端 localStorage**。
- 后端所有用到 key 的地方都走 `getApiKey()`，不要直接读 `process.env`（否则界面设置的 key 不生效）。
- 完整 Prompt 与模型原始输出同样不得暴露浏览器端。

## 重启说明

改完后端 `server.js` / `adapters/*` 后需要重启后端进程（内存里的 key 会清空，重新用环境变量或界面输入即可）。前端改完 `npm run dev` 会热更新。
