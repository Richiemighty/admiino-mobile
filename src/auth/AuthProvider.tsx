import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../api';
import type { LoginRequest, MobileUser, MobileWorkspace } from '../api/types';
import { sessionService } from './session';

export type AuthStatus =
  'restoring' | 'signed-out' | 'authenticated' | 'access-denied' | 'suspended';

interface AuthContextValue {
  status: AuthStatus;
  user: MobileUser | null;
  workspaces: MobileWorkspace[];
  activeWorkspace: MobileWorkspace | null;
  error: string | null;
  restore: () => Promise<void>;
  login: (request: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function statusFromError(error: unknown): AuthStatus {
  if (error instanceof ApiError && error.status === 423) return 'suspended';
  if (error instanceof ApiError && error.status === 403) return 'access-denied';
  return 'signed-out';
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<MobileUser | null>(null);
  const [workspaces, setWorkspaces] = useState<MobileWorkspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<MobileWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  const restore = async () => {
    setStatus('restoring');
    setError(null);
    try {
      const token = await sessionService.restoreSession();
      if (!token) {
        setStatus('signed-out');
        setUser(null);
        setWorkspaces([]);
        setActiveWorkspace(null);
        return;
      }
      try {
        const [me, workspaceResponse] = await Promise.all([
          sessionService.getMe(token),
          sessionService.getWorkspaces(token),
        ]);
        setUser(me.data.user);
        setWorkspaces(workspaceResponse.data.workspaces);
        setActiveWorkspace(workspaceResponse.data.workspaces[0] ?? null);
        setStatus('authenticated');
      } catch (restoreError) {
        const nextStatus = statusFromError(restoreError);
        setStatus(nextStatus);
      }
    } catch (restoreError) {
      setStatus('signed-out');
      if (restoreError instanceof ApiNetworkError || restoreError instanceof ApiTimeoutError) {
        setError(restoreError.message);
      }
    }
  };

  useEffect(() => {
    // Restore is asynchronous and updates state only after secure storage/session validation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void restore();
  }, []);

  const login = async (request: LoginRequest) => {
    setError(null);
    try {
      const loginResponse = await sessionService.prepareLogin(request);
      const [me, workspaceResponse] = await Promise.all([
        sessionService.getMe(loginResponse.token),
        sessionService.getWorkspaces(loginResponse.token),
      ]);
      setUser(me.data.user);
      setWorkspaces(workspaceResponse.data.workspaces);
      setActiveWorkspace(workspaceResponse.data.workspaces[0] ?? null);
      setStatus('authenticated');
    } catch (loginError) {
      if (loginError instanceof ApiError && loginError.status === 401) {
        await sessionService.logout();
        setStatus('signed-out');
        const verificationRequired =
          loginError.payload?.message === 'Please verify your email before logging in.';
        throw new Error(
          verificationRequired
            ? 'Please verify your email before logging in.'
            : 'Email or password is incorrect.',
        );
      }
      if (loginError instanceof ApiError && loginError.status === 423) {
        setStatus('suspended');
        throw new Error('This workspace is temporarily suspended.');
      }
      if (loginError instanceof ApiError && loginError.status === 403) {
        setStatus('access-denied');
        throw new Error(loginError.payload?.message || 'Access denied.');
      }
      if (loginError instanceof ApiError && loginError.status === 429) {
        throw new Error('Too many sign-in attempts. Please try again shortly.');
      }
      if (loginError instanceof ApiNetworkError || loginError instanceof ApiTimeoutError) {
        throw loginError;
      }
      throw loginError;
    }
  };

  const logout = async () => {
    await sessionService.logout();
    setUser(null);
    setWorkspaces([]);
    setActiveWorkspace(null);
    setError(null);
    setStatus('signed-out');
  };

  const value = useMemo(
    () => ({
      status,
      user,
      workspaces,
      activeWorkspace,
      error,
      restore,
      login,
      logout,
      clearError: () => setError(null),
    }),
    [status, user, workspaces, activeWorkspace, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
