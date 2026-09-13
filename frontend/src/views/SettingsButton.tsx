import { useState } from 'react';
import { setApiKey, getConfigStatus } from '../api/api';
import { readGraphDisplaySettings, saveGraphDisplaySettings } from '../graph/displaySettings';

export default function SettingsButton() {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<{ source: string; has_key: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [graphDisplay, setGraphDisplay] = useState(readGraphDisplaySettings);

  const updateGraphDisplay = (next: Partial<typeof graphDisplay>) => {
    const saved = saveGraphDisplaySettings({ ...graphDisplay, ...next });
    setGraphDisplay(saved);
  };

  const load = async () => {
    setBusy(true);
    setErr(null);
    try {
      const env = await getConfigStatus();
      setStatus(env.ok ? env.data ?? null : null);
    } catch (e: any) {
      setErr(e?.message ?? '获取状态失败');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const env = await setApiKey(key);
      setStatus(env.ok ? env.data ?? null : null);
      setKey('');
      // 无论是新增、更换还是清空密钥，都让全局警告立即同步。
      if (env.ok) window.dispatchEvent(new Event('kt-config-changed'));
    } catch (e: any) {
      setErr(e?.message ?? '设置失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className="settings-fab"
        title="设置 API Key"
        onClick={() => {
          setOpen(true);
          load();
        }}
      >
        ⚙️
      </button>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>设置</h2>
            <p className="hint">
              输入 DeepSeek API Key。仅保存在后端内存，不回传、不写入文件，优先于环境变量。
            </p>
            <div className="field">
              <label>API Key</label>
              <input
                type="password"
                placeholder="sk-…"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </div>
            <div className="row">
              <button className="primary" disabled={busy} onClick={save}>保存</button>
              <button className="ghost" disabled={busy} onClick={load}>刷新状态</button>
            </div>
            {status && (
              <p className="muted">
                当前来源：
                {status.source === 'ui' ? '界面设置' : status.source === 'env' ? '环境变量' : '未配置'}
                {' · '}
                {status.has_key ? '已配置 Key' : '未配置 Key'}
              </p>
            )}
            {err && <p className="warn-text">{err}</p>}
            <div className="settings-divider" />
            <h3 className="settings-section-title">图谱显示</h3>
            <div className="range-setting">
              <div>
                <label htmlFor="node-size-range">节点大小</label>
                <output>{Math.round(graphDisplay.nodeScale * 100)}%</output>
              </div>
              <input
                id="node-size-range"
                type="range"
                min="0.6"
                max="1.8"
                step="0.05"
                value={graphDisplay.nodeScale}
                onChange={(event) => updateGraphDisplay({ nodeScale: Number(event.target.value) })}
              />
            </div>
            <div className="range-setting">
              <div>
                <label htmlFor="label-size-range">文字大小</label>
                <output>{Math.round(graphDisplay.labelScale * 100)}%</output>
              </div>
              <input
                id="label-size-range"
                type="range"
                min="0.6"
                max="1.8"
                step="0.05"
                value={graphDisplay.labelScale}
                onChange={(event) => updateGraphDisplay({ labelScale: Number(event.target.value) })}
              />
            </div>
            <button className="ghost" onClick={() => setOpen(false)}>关闭</button>
          </div>
        </div>
      )}
    </>
  );
}
