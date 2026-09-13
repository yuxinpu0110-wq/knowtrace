// 运行时 API Key 存储：优先用「界面设置」的 key（内存覆盖），其次服务器环境变量。
// 仅供调试/演示：key 由前端界面经本机 HTTP 发送到后端，只存后端内存，绝不写文件、绝不回传浏览器。

// 出于安全，仓库不内置任何 Key。要接真实 DeepSeek，二选一：
//   1) 启动后界面左下角 ⚙️ 填 Key（只存后端内存，重启即失效）；
//   2) 复制 .env.example 为 .env 填入 DEEPSEEK_API_KEY（.env 已被 gitignore，不会入库）。
// 两者都不填时，后端自动回退内置 Mock，演示链路照常完整可跑。
const DEFAULT_DEMO_KEY = '';

let overrideKey = '';

export function setApiKey(k) {
  overrideKey = String(k ?? '').trim();
}

export function getApiKey() {
  return overrideKey || process.env.DEEPSEEK_API_KEY || DEFAULT_DEMO_KEY;
}

export function hasKey() {
  return Boolean(getApiKey());
}

// 返回 key 来源：'ui' 界面输入 / 'env' 环境变量 / 'none' 未设置。
export function keySource() {
  if (overrideKey) return 'ui';
  if (process.env.DEEPSEEK_API_KEY) return 'env';
  if (DEFAULT_DEMO_KEY) return 'demo';
  return 'none';
}
