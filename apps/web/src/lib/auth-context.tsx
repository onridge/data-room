import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiFetch } from './api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = 'data-room-auth';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const readStoredAuth = (): AuthResponse | null => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthResponse;
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyAuth = useCallback((auth: AuthResponse) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    setUser(auth.user);
    setAccessToken(auth.accessToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setAccessToken(null);
  }, []);

  useEffect(() => {
    const stored = readStoredAuth();
    if (!stored) {
      setIsLoading(false);
      return;
    }

    setUser(stored.user);
    setAccessToken(stored.accessToken);

    // Stored token may have expired or been revoked — confirm against the
    // API instead of trusting localStorage blindly.
    apiFetch<AuthUser>('/auth/me', { token: stored.accessToken })
      .then((freshUser) => setUser(freshUser))
      .catch(() => logout())
      .finally(() => setIsLoading(false));
  }, [logout]);

  const login = useCallback(
    async (email: string, password: string) => {
      const auth = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      applyAuth(auth);
    },
    [applyAuth],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const auth = await apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      });
      applyAuth(auth);
    },
    [applyAuth],
  );

  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      const auth = await apiFetch<AuthResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });
      applyAuth(auth);
    },
    [applyAuth],
  );

  const value = useMemo(
    () => ({ user, accessToken, isLoading, login, register, loginWithGoogle, logout }),
    [user, accessToken, isLoading, login, register, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
