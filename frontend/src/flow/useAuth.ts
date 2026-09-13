import { useCallback, useState } from 'react';
import {
  fetchCurrentUser,
  getStoredUser,
  login as apiLogin,
  logout as apiLogout,
  setStoredUser,
  type AuthUser,
} from '../api/auth';

// 登录态：以本地已存用户为初始值（避免刷新闪一下登录页），再向后端校验 Cookie 会话。
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async (username: string, password: string) => {
    setBusy(true);
    setError(null);
    try {
      const u = await apiLogin(username, password);
      setStoredUser(u);
      setUser(u);
      return true;
    } catch (e: any) {
      setError(e?.message ?? '登录失败');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await apiLogout();
    } finally {
      setStoredUser(null);
      setUser(null);
      setError(null);
      setBusy(false);
    }
  }, []);

  // 刷新后校验 Cookie 会话：失效则回到未登录态。
  const verify = useCallback(async () => {
    const u = await fetchCurrentUser();
    if (!u) {
      setStoredUser(null);
      setUser(null);
    } else {
      setStoredUser(u);
      setUser(u);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { user, busy, error, signIn, signOut, verify, clearError };
}

export type Auth = ReturnType<typeof useAuth>;
