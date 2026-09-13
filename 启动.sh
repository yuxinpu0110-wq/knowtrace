#!/usr/bin/env bash
# 知溯KnowTrace 启动器（macOS / Linux）
set -e
cd "$(dirname "$0")"

echo
echo "  知溯KnowTrace · 知识断点诊断"
echo "  ------------------------------------------------"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "  [错误] 没有找到 Node.js。请先安装 Node.js 18+：https://nodejs.org/"
  exit 1
fi

major=$(node -p 'process.versions.node.split(".")[0]')
if [ "$major" -lt 18 ]; then
  echo "  [错误] Node.js 版本过低，需要 18 及以上。当前：$(node -v)"
  exit 1
fi

if [ ! -f "frontend/dist/index.html" ]; then
  echo "  [错误] 缺少前端构建产物 frontend/dist/index.html。"
  echo "  若你是从源码运行，请先执行：cd frontend && npm install && npm run build"
  exit 1
fi

echo "  Node.js 版本：$(node -v)"
echo "  运行目录：$(pwd)"
echo
echo "  正在启动服务，浏览器会自动打开 ..."
echo

export KT_AUTO_PORT=1
export KT_OPEN_BROWSER=1

exec node backend/server.js
