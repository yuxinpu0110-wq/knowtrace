import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './App.css';

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[KnowTrace] 页面渲染失败', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <div>
          <span>KnowTrace</span>
          <h1>页面加载遇到问题</h1>
          <p>{this.state.error.message || '未知前端错误'}</p>
          <button onClick={() => { localStorage.removeItem('knowtrace_user'); localStorage.removeItem('knowtrace_token'); window.location.assign('/login'); }}>
            清除本地登录状态并重新进入
          </button>
        </div>
      </main>
    );
  }
}

function mount() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppErrorBoundary><App /></AppErrorBoundary>
    </StrictMode>,
  );
}

// 交付版是「单个 HTML + 内联经典 <script>」：脚本放在 <head>，浏览器会忽略内联脚本的 defer，
// 会在解析到 <body> 之前就执行到这里，此刻 <div id="root"> 尚未解析出来，直接 createRoot 会拿到
// null（React 报 #299）。等 DOM 就绪后再挂载，file:// 双击打开与后端托管两种场景都稳。
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
