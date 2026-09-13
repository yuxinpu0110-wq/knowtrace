import { useEffect, useMemo, useState } from 'react';
import { useFlow } from './flow/useFlow';
import { useAuth } from './flow/useAuth';
import { navigate, useRoute } from './router';
import GraphPanel from './components/GraphPanel';
import { HomeView } from './views/HomeView';
import { EditView } from './views/EditView';
import { GraphManagerView } from './views/GraphManagerView';
import { ProblemView } from './views/ProblemView';
import { TestView } from './views/TestView';
import { LearnView } from './views/LearnView';
import SettingsButton from './views/SettingsButton';
import LoginView from './views/LoginView';
import { fetchUserProgress, saveUserProgress } from './api/auth';
import type { GraphData } from './types';
import BrandMark from './components/BrandMark';
import { getConfigStatus } from './api/api';

export default function App() {
  const auth = useAuth();
  const flow = useFlow();
  const route = useRoute();
  const { state, stateMap, distanceMap, intensityMap, revealRef, actions } = flow;
  const diagnosisWeakIds = useMemo(
    () => (state.diagnosis?.weak_points ?? []).map((point) => point.node_id),
    [state.diagnosis],
  );

  // 进度是否已从后端载入完成。必须等它完成才允许回写，
  // 否则登录瞬间会用「空状态」覆盖掉该用户已保存的图谱与已掌握节点。
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const username = auth.user?.username ?? null;

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const result = await getConfigStatus();
        if (!cancelled) setApiConfigured(Boolean(result.ok && result.data?.has_key));
      } catch {
        if (!cancelled) setApiConfigured(false);
      }
    };
    refresh();
    window.addEventListener('kt-config-changed', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('kt-config-changed', refresh);
    };
  }, [username]);

  // 登录后：载入该用户的知识图谱与已掌握节点（用户信息存储系统）
  useEffect(() => {
    if (!username) {
      setProgressLoaded(false);
      return;
    }
    let cancelled = false;
    setProgressLoaded(false);
    (async () => {
      const p = await fetchUserProgress();
      if (cancelled) return;
      if (p) {
        actions.hydrate({
          textbook: p.textbook ?? '',
          graph: (p.graph as GraphData | null) ?? null,
          masteredIds: p.masteredIds ?? [],
          retainedWeakIds: p.retainedWeakIds ?? [],
          knowledgeGraphs: p.knowledgeGraphs,
          activeGraphId: p.activeGraphId,
        });
      }
      setProgressLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // 图谱 / 已掌握变化时保存（防抖 800ms）
  useEffect(() => {
    if (!username || !progressLoaded) return;
    const timer = setTimeout(() => {
      saveUserProgress({
        textbook: state.textbook,
        graph: state.graph,
        masteredIds: state.masteredIds,
        retainedWeakIds: state.retainedWeakIds,
        knowledgeGraphs: flow.graphs,
        activeGraphId: state.activeGraphId,
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [username, progressLoaded, state.textbook, state.graph, state.masteredIds, state.retainedWeakIds, state.activeGraphId, flow.graphs]);

  // 已登录却停在 /login：回到首页
  useEffect(() => {
    if (username && route === '/login') navigate('/');
  }, [username, route]);

  const handleSignOut = async () => {
    await auth.signOut();
    actions.reset();
    navigate('/login');
  };

  const handleBack = () => {
    if (route === '/edit') navigate('/graphs');
    else if (route === '/learn') actions.backFromLearn();
    else if (route === '/test') navigate('/problem');
    else actions.goHome();
  };

  // 未登录：只渲染登录页（图谱与主链路不挂载）
  if (!auth.user) return <LoginView auth={auth} />;

  // 图谱点选：诊断完成后、或首页「直接学习」模式下进入「选知识点」阶段，
  // 点击即开始学习（同一条 chooseToLearn）；其余情况仅选中。
  const handleNodeSelect = (id: string) => {
    if (route === '/test' && state.diagnosisDone) actions.chooseToLearn(id);
    else if (route === '/' && state.directLearn) actions.chooseToLearn(id);
    else actions.selectNode(id);
  };

  const view = (() => {
    switch (route) {
      case '/edit':
        return <EditView flow={flow} />;
      case '/graphs':
        return <GraphManagerView flow={flow} />;
      case '/problem':
        return <ProblemView flow={flow} />;
      case '/test':
        return <TestView flow={flow} />;
      case '/learn':
        return <LearnView flow={flow} />;
      default:
        return <HomeView flow={flow} />;
    }
  })();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <BrandMark compact />
          <div>
            <h1>知溯 <span>KnowTrace</span></h1>
            <p className="muted">找到真正卡住你的知识点</p>
          </div>
        </div>
        <div className="topbar-actions">
          {route !== '/' && (
            <button className="ghost" onClick={handleBack}>← 返回</button>
          )}
          <label className="switch">
            <input type="checkbox" checked={state.mockMode} onChange={() => actions.toggleMockMode()} />
            <span>内置 Mock</span>
          </label>
          <button className="ghost" onClick={() => actions.reset()}>重置</button>
          <span className="user-chip" title={`${auth.user.role === 'super' ? '管理员' : '用户'}：${auth.user.username}`}>
            👤 {auth.user.displayName}
          </span>
          <button className="ghost" onClick={handleSignOut}>登出</button>
        </div>
      </header>

      <main className="layout">
        <aside className="graph-pane">
          {state.graph ? (
            <GraphPanel
              graph={state.graph}
              stateMap={stateMap}
              distanceMap={distanceMap}
              intensityMap={intensityMap}
              seedId={state.seedId}
              selectedId={state.selectedNodeId}
              learningNodeId={state.teachingNodeId}
              learningProgress={state.learningProgress}
              diagnosisFocus={route === '/test'}
              diagnosisWeakIds={diagnosisWeakIds}
              revealRef={revealRef}
              onSelect={handleNodeSelect}
            />
          ) : (
            <div className="graph-empty">
              <div className="empty-inner">
                <BrandMark />
                <p className="empty-title">从一份教材，构建你的知识路径</p>
                <p className="muted">先点「编辑」导入教材，生成你的专属知识图谱</p>
                <button className="primary" onClick={actions.goEdit}>开始构建</button>
              </div>
            </div>
          )}
        </aside>

        <section className="control-pane">
          <div className="scroll">
            {(apiConfigured === false || state.mockMode) && (
              <div className="api-warning" role="status">
                <span aria-hidden="true">!</span>
                <div>
                  <strong>{state.mockMode ? '当前已开启内置 Mock' : '尚未接入 AI API'}</strong>
                  <p>正在使用有限的内置演示逻辑，回答与诊断可能不够准确。请点击左下角设置按钮配置 DeepSeek API Key。</p>
                </div>
              </div>
            )}
            {state.error && <div className="err-banner">{state.error}</div>}
            {!state.error && state.degraded && (
              <div className="degraded-banner">后端不可用，已降级到内置 Mock 数据</div>
            )}
            {view}
          </div>
        </section>
      </main>

      <SettingsButton />
    </div>
  );
}
