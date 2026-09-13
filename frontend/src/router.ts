// 极简前端路由（不引入 react-router）：基于 URL hash，支持浏览器前进/后退。
// 路由即「环节」：#/login 登录、#/ 首页、#/edit 编辑、#/problem 提问定位、#/test 诊断、#/learn 学习验证。
//
// 为什么用 hash 而不是 History API：
// 交付版要能从 file:// 直接双击打开（评委 clone 下来就能跑，不需要 Node、不需要起服务）。
// History API 的 pushState 在 file:// 下不可用，且深链刷新需要服务端做 SPA fallback；
// hash 两种场景都能用 —— 后端托管时同样正常工作。
import { useEffect, useState } from 'react';

export type RoutePath = '/login' | '/' | '/graphs' | '/edit' | '/problem' | '/test' | '/learn';

const KNOWN: RoutePath[] = ['/login', '/', '/graphs', '/edit', '/problem', '/test', '/learn'];

function parseHash(): RoutePath {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return (KNOWN as string[]).includes(withSlash) ? (withSlash as RoutePath) : '/';
}

export function currentRoute(): RoutePath {
  return parseHash();
}

export function navigate(path: RoutePath) {
  if (currentRoute() === path) return;
  window.location.hash = path;
  // 某些环境（如 jsdom、部分内嵌浏览器）不派发 hashchange，这里补一次事件保证 UI 一定更新。
  window.dispatchEvent(new Event('kt-route'));
}

export function useRoute(): RoutePath {
  const [path, setPath] = useState<RoutePath>(currentRoute);
  useEffect(() => {
    const onChange = () => setPath(currentRoute());
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    window.addEventListener('kt-route', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
      window.removeEventListener('kt-route', onChange);
    };
  }, []);
  return path;
}
