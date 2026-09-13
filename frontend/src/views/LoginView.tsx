import { useState } from 'react';
import type { Auth } from '../flow/useAuth';
import { DEMO_ACCOUNT_HINTS, getBackendNotice, isBackendDown } from '../api/auth';
import BrandMark from '../components/BrandMark';

// 登录页（7号 依 docs/08 约定实现）：只负责收集用户名/密码，校验一律在后端完成。
// 队友交付他自己的登录 UI 后，替换本文件即可，其余接线无需改动。
export default function LoginView({ auth }: { auth: Auth }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showDemo, setShowDemo] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    await auth.signIn(username, password);
  };

  const quickLogin = async (name: 'Yuxinpu0110' | 'Xgyr0613') => {
    const demoPassword = name === 'Yuxinpu0110' ? 'abcde0110' : 'tsy0821';
    setUsername(name);
    setPassword(demoPassword);
    auth.clearError();
    await auth.signIn(name, demoPassword);
  };

  return (
    <div className="login-page">
      <section className="login-story">
        <div className="login-story-inner">
          <div className="login-wordmark"><BrandMark compact /><span>知溯 KnowTrace</span></div>
          <div className="login-promise">
            <span className="eyebrow">不急着问答案</span>
            <h2>先找到你<br />卡住的地方。</h2>
            <p>从一个问题出发，看见更大的知识世界。</p>
          </div>
          <div className="trace-line" aria-hidden="true">
            <i /><i /><i className="active" /><i className="mastered" />
          </div>
        </div>
      </section>
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <BrandMark />
          <div>
            <h1>欢迎回来</h1>
            <p className="muted">登录以继续你的学习路径</p>
          </div>
        </div>

        <div className="field">
          <label htmlFor="kt-username">用户名</label>
          <input
            id="kt-username"
            type="text"
            autoComplete="username"
            placeholder="请输入用户名"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              auth.clearError();
            }}
          />
        </div>

        <div className="field">
          <label htmlFor="kt-password">密码</label>
          <input
            id="kt-password"
            type="password"
            autoComplete="current-password"
            placeholder="请输入密码"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              auth.clearError();
            }}
          />
        </div>

        {auth.error && <p className="login-error">{auth.error}</p>}

        <button className="primary login-submit" type="submit" disabled={auth.busy || !username.trim() || !password}>
          {auth.busy ? '登录中…' : '登录'}
        </button>

        <div className="quick-login">
          <div className="quick-login-label"><span>快捷登录</span></div>
          <div className="quick-login-buttons">
            <button type="button" className="ghost" disabled={auth.busy} onClick={() => quickLogin('Yuxinpu0110')}>
              Yuxinpu0110
            </button>
            <button type="button" className="ghost" disabled={auth.busy} onClick={() => quickLogin('Xgyr0613')}>
              Xgyr0613
            </button>
          </div>
        </div>

        <button type="button" className="link-btn" onClick={() => setShowDemo((v) => !v)}>
          {showDemo ? '收起演示账号' : '查看演示账号'}
        </button>
        {showDemo && (
          <div className="login-demo">
            <p className="muted">演示账号（后端不可用时同样可用）：</p>
            <ul>
              {DEMO_ACCOUNT_HINTS.map((name) => (
                <li key={name}>
                  <code>{name}</code>
                </li>
              ))}
            </ul>
            <p className="muted">
              登录校验在后端完成（密码 scrypt 哈希存储）；凭据只经 httpOnly Cookie 传输，前端不保存令牌。
            </p>
          </div>
        )}

        {isBackendDown() && (
          <p className="warn-text">
            {getBackendNotice() ?? '后端不可用'}，当前为本地演示登录模式（进度只存在本机浏览器）。
          </p>
        )}
      </form>
    </div>
  );
}
