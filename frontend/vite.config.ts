import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 交付版关键点：把入口从 ESM（`<script type="module" crossorigin>`）改成经典脚本（`<script>`）。
//
// file:// 下浏览器会因 CORS 直接拒绝 `type="module"` 的脚本，导致评委双击 index.html 打开时
// React 不渲染（#root 空白）。经典脚本没有这个限制，file:// 也能跑。
//
// 挂载时机由 src/main.tsx 处理：内联经典脚本放在 <head> 会被立即执行（内联脚本的 defer 被浏览器忽略），
// 此时 <div id="root"> 还没解析出来，所以 main.tsx 里等 DOMContentLoaded 再 createRoot().render()。
//
// 严格模式由 Rollup 的 iife 输出保证（整包包进 (function(){ 'use strict'; ... })()），
// 与 ESM 的模块作用域、严格模式语义等价。同一个文件被后端 express.static 托管时同样正常。
const classicEntry = (): Plugin => ({
  name: 'kt-classic-entry',
  apply: 'build',
  enforce: 'post',
  generateBundle(_opts, bundle) {
    const html = bundle['index.html'];
    if (html && html.type === 'asset' && typeof html.source === 'string') {
      html.source = html.source.replace(/<script type="module" crossorigin>/g, '<script>');
    }
  },
});

export default defineConfig({
  plugins: [react(), viteSingleFile({ useRecommendedBuildConfig: false }), classicEntry()],
  base: './',
  build: {
    // 交付版打成单个自包含 HTML：JS、CSS、KaTeX 字体全部内联为 data URI，
    // 这样从 file:// 直接双击打开也能完整运行（file:// 下任何 fetch/字体请求都会被 CORS 拦）。
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 100000,
    assetsDir: '',
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      // 前端统一调用同源 /api，开发时由 Vite 转发到后端，规避 CORS。
      '/api': 'http://localhost:3001',
    },
  },
});
