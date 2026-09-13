@echo off
chcp 65001 >nul
setlocal
title 知溯KnowTrace - 启动器
cd /d "%~dp0"

echo.
echo   知溯KnowTrace . 知识断点诊断
echo   ------------------------------------------------
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [错误] 没有找到 Node.js。
  echo.
  echo   请先安装 Node.js 18 或更高版本: https://nodejs.org/
  echo   安装后重新双击本文件即可，不需要 npm install。
  echo.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p process.versions.node') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 18 (
  echo   [错误] Node.js 版本过低，需要 18 及以上。当前版本:
  node -v
  echo   请升级: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist "frontend\dist\index.html" (
  echo   [错误] 缺少前端构建产物 frontend\dist\index.html。
  echo   这个包应当自带它。若你是从源码运行，请先执行:
  echo       cd frontend ^&^& npm install ^&^& npm run build
  echo.
  pause
  exit /b 1
)

echo   Node.js 版本:
node -v
echo   运行目录: %CD%
echo.
echo   正在启动服务，浏览器会自动打开 ...
echo   若未自动打开，请手动访问下面打印的地址。
echo.

set KT_AUTO_PORT=1
set KT_OPEN_BROWSER=1

if exist ".env" (
  echo   已加载 .env
  node --env-file=.env "backend\server.js"
) else (
  node "backend\server.js"
)

echo.
echo   [服务已停止] 按任意键关闭本窗口。
pause >nul
