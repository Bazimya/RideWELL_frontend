import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, onSessionEnd, refreshSession, setAccessToken, type SelfUser } from '../api/client';

interface AuthState {
  status: 'loading' | 'signedIn' | 'signedOut';
  user: SelfUser | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** UI hint only (menus, buttons). The API enforces every permission. */
  can: (permission: string) => boolean;
  signedIn: (accessToken: string, user: SelfUser) => void;
  updateUser: (user: SelfUser) => void;
  signOut: (everywhere?: boolean) => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<SelfUser | null>(null);

  useEffect(() => {
    onSessionEnd(() => {
      setAccessToken(null);
      setUser(null);
      setStatus('signedOut');
    });
    void refreshSession().then((r) => {
      if (r) {
        setUser(r.user);
        setStatus('signedIn');
      } else setStatus('signedOut');
    });
  }, []);

  const signedIn = useCallback((token: string, u: SelfUser) => {
    setAccessToken(token);
    setUser(u);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async (everywhere = false) => {
    try {
      await api(everywhere ? '/auth/logout-all' : '/auth/logout', { method: 'POST', noRefresh: true });
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus('signedOut');
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user,
      isAdmin: Boolean(user?.roles.some((r) => r === 'staff' || r === 'super_admin')),
      can: (p: string) => Boolean(user?.permissions?.includes(p)),
      isSuperAdmin: Boolean(user?.roles.includes('super_admin')),
      signedIn,
      updateUser: setUser,
      signOut,
    }),
    [status, user, signedIn, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
