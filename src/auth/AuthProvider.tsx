import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../api';
import type {
  EffectiveWorkspacePermissions,
  LoginRequest,
  MobileUser,
  MobileWorkspace,
} from '../api/types';
import { clearConversationDrafts } from '../features/tasks/conversationDraft';
import { deleteTemporaryConversationFiles } from '../features/tasks/conversationDraftFiles';
import { workspaceService } from '../workspace/service';
import { sessionService } from './session';

export type AuthStatus =
  'restoring' | 'signed-out' | 'authenticated' | 'access-denied' | 'suspended';

export type WorkspacePermissionStatus =
  'idle' | 'loading' | 'ready' | 'access-denied' | 'suspended' | 'error';

interface AuthContextValue {
  status: AuthStatus;
  user: MobileUser | null;
  workspaces: MobileWorkspace[];
  activeWorkspace: MobileWorkspace | null;
  selectedWorkspaceId: string | null;
  permissions: EffectiveWorkspacePermissions | null;
  workspacePermissionStatus: WorkspacePermissionStatus;
  workspaceError: string | null;
  error: string | null;
  restore: () => Promise<void>;
  login: (request: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: (signal?: AbortSignal) => Promise<MobileUser>;
  applyUserProfileUpdate: (
    userId: string,
    updates: Partial<Pick<MobileUser, 'firstName' | 'lastName' | 'bio' | 'profilePictureUrl'>>,
  ) => void;
  selectWorkspace: (workspaceId: string) => Promise<boolean>;
  refreshWorkspaces: (preferredWorkspaceId?: string) => Promise<boolean>;
  clearError: () => void;
  clearWorkspaceError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function statusFromError(error: unknown): AuthStatus {
  if (error instanceof ApiError && error.status === 423) return 'suspended';
  if (error instanceof ApiError && error.status === 403) return 'access-denied';
  return 'signed-out';
}

function eligibleWorkspaces(workspaces: MobileWorkspace[]) {
  return workspaces.filter(
    (workspace) => workspace.status === 'active' && workspace.companyId === workspace.company.id,
  );
}

function workspaceErrorMessage(error: unknown) {
  if (error instanceof ApiNetworkError)
    return 'Could not reach the service. Check your connection and try again.';
  if (error instanceof ApiTimeoutError) return 'The request timed out. Please try again.';
  if (error instanceof Error && error.message) return error.message;
  return 'Workspace access could not be loaded. Please try again.';
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<MobileUser | null>(null);
  const [workspaces, setWorkspaces] = useState<MobileWorkspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<MobileWorkspace | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<EffectiveWorkspacePermissions | null>(null);
  const [workspacePermissionStatus, setWorkspacePermissionStatus] =
    useState<WorkspacePermissionStatus>('idle');
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workspaceRequest = useRef(0);

  const clearWorkspaceState = useCallback(() => {
    workspaceRequest.current += 1;
    setWorkspaces([]);
    setActiveWorkspace(null);
    setSelectedWorkspaceId(null);
    setPermissions(null);
    setWorkspacePermissionStatus('idle');
    setWorkspaceError(null);
  }, []);

  const activateWorkspace = async (workspace: MobileWorkspace, token: string): Promise<boolean> => {
    const requestId = ++workspaceRequest.current;
    setActiveWorkspace(null);
    setSelectedWorkspaceId(workspace.companyId);
    setPermissions(null);
    setWorkspacePermissionStatus('loading');
    setWorkspaceError(null);

    try {
      await sessionService.setSelectedWorkspaceId(workspace.companyId);
      const response = await workspaceService.getEffectivePermissions(token, workspace.companyId);
      if (response.data.companyId !== workspace.companyId) {
        throw new ApiError('The backend returned permissions for a different workspace.', 502);
      }
      if (requestId !== workspaceRequest.current) return false;

      const currentWorkspace = { ...workspace, role: response.data.role };
      setWorkspaces((current) =>
        current.map((item) =>
          item.companyId === currentWorkspace.companyId ? currentWorkspace : item,
        ),
      );
      setActiveWorkspace(currentWorkspace);
      setPermissions(response.data);
      setWorkspacePermissionStatus('ready');
      return true;
    } catch (activationError) {
      if (requestId !== workspaceRequest.current) return false;

      if (activationError instanceof ApiError && activationError.status === 401) {
        await sessionService.logout();
        clearWorkspaceState();
        setUser(null);
        setStatus('signed-out');
        return false;
      }

      if (activationError instanceof ApiError && activationError.status === 403) {
        await sessionService.clearSelectedWorkspaceId();
        setActiveWorkspace(null);
        setSelectedWorkspaceId(null);
        setPermissions(null);
        setWorkspacePermissionStatus('access-denied');
        setWorkspaceError('You no longer have access to this workspace. Choose another workspace.');
        try {
          const response = await sessionService.getWorkspaces(token);
          if (requestId === workspaceRequest.current) {
            setWorkspaces(eligibleWorkspaces(response.data.workspaces));
          }
        } catch (refreshError) {
          if (requestId === workspaceRequest.current) {
            setWorkspaceError(workspaceErrorMessage(refreshError));
            setWorkspacePermissionStatus('error');
          }
        }
        return false;
      }

      setActiveWorkspace(workspace);
      setPermissions(null);
      if (activationError instanceof ApiError && activationError.status === 423) {
        setWorkspacePermissionStatus('suspended');
        setWorkspaceError('This workspace is temporarily suspended.');
      } else {
        setWorkspacePermissionStatus('error');
        setWorkspaceError(workspaceErrorMessage(activationError));
      }
      return false;
    }
  };

  const chooseInitialWorkspace = async (availableWorkspaces: MobileWorkspace[], token: string) => {
    const storedId = await sessionService.getSelectedWorkspaceId();
    const storedWorkspace = availableWorkspaces.find(
      (workspace) => workspace.companyId === storedId,
    );

    const storedWorkspaceIsStale = Boolean(storedId && !storedWorkspace);
    if (storedWorkspaceIsStale) {
      await sessionService.clearSelectedWorkspaceId();
    }

    const target =
      storedWorkspace ??
      (!storedWorkspaceIsStale && availableWorkspaces.length === 1 ? availableWorkspaces[0] : null);
    if (target) {
      await activateWorkspace(target, token);
      return;
    }

    setSelectedWorkspaceId(null);
    setActiveWorkspace(null);
    setPermissions(null);
    setWorkspacePermissionStatus('idle');
  };

  const restore = async () => {
    setStatus('restoring');
    setError(null);
    setUser(null);
    clearWorkspaceState();
    try {
      const token = await sessionService.restoreSession();
      if (!token) {
        setStatus('signed-out');
        return;
      }
      const [me, workspaceResponse] = await Promise.all([
        sessionService.getMe(token),
        sessionService.getWorkspaces(token),
      ]);
      const availableWorkspaces = eligibleWorkspaces(workspaceResponse.data.workspaces);
      setUser(me.data.user);
      setWorkspaces(availableWorkspaces);
      setStatus('authenticated');
      await chooseInitialWorkspace(availableWorkspaces, token);
    } catch (restoreError) {
      setStatus(statusFromError(restoreError));
      if (restoreError instanceof ApiNetworkError || restoreError instanceof ApiTimeoutError) {
        setError(restoreError.message);
      }
    }
  };

  useEffect(() => {
    // Restore is asynchronous and updates state only after secure storage/session validation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void restore();
    // The session is intentionally restored once per provider mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (request: LoginRequest) => {
    setError(null);
    try {
      const loginResponse = await sessionService.prepareLogin(request);
      const [me, workspaceResponse] = await Promise.all([
        sessionService.getMe(loginResponse.token),
        sessionService.getWorkspaces(loginResponse.token),
      ]);
      const availableWorkspaces = eligibleWorkspaces(workspaceResponse.data.workspaces);
      setUser(me.data.user);
      setWorkspaces(availableWorkspaces);
      setStatus('authenticated');
      await chooseInitialWorkspace(availableWorkspaces, loginResponse.token);
    } catch (loginError) {
      if (loginError instanceof ApiError && loginError.status === 401) {
        await sessionService.logout();
        clearWorkspaceState();
        setUser(null);
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

  const selectWorkspace = async (workspaceId: string) => {
    const target = workspaces.find((workspace) => workspace.companyId === workspaceId);
    if (!target) {
      setWorkspaceError('Choose a workspace that belongs to your account.');
      return false;
    }
    const requestId = ++workspaceRequest.current;
    setActiveWorkspace(null);
    setSelectedWorkspaceId(workspaceId);
    setPermissions(null);
    setWorkspacePermissionStatus('loading');
    setWorkspaceError(null);
    try {
      await sessionService.setSelectedWorkspaceId(workspaceId);
      const token = await sessionService.restoreSession();
      if (requestId !== workspaceRequest.current) return false;
      if (!token) {
        clearWorkspaceState();
        setUser(null);
        setStatus('signed-out');
        return false;
      }
      setStatus('authenticated');
      return await activateWorkspace(target, token);
    } catch (selectionError) {
      if (requestId !== workspaceRequest.current) return false;
      setActiveWorkspace(null);
      setPermissions(null);
      setWorkspacePermissionStatus('error');
      setWorkspaceError(workspaceErrorMessage(selectionError));
      return false;
    }
  };

  const refreshWorkspaces = async (preferredWorkspaceId?: string) => {
    const requestId = ++workspaceRequest.current;
    setActiveWorkspace(null);
    setPermissions(null);
    setWorkspacePermissionStatus('loading');
    setWorkspaceError(null);
    try {
      const token = await sessionService.restoreSession();
      if (!token) {
        clearWorkspaceState();
        setUser(null);
        setStatus('signed-out');
        return false;
      }
      const response = await sessionService.getWorkspaces(token);
      if (requestId !== workspaceRequest.current) return false;
      const availableWorkspaces = eligibleWorkspaces(response.data.workspaces);
      setWorkspaces(availableWorkspaces);

      const storedId = preferredWorkspaceId ?? (await sessionService.getSelectedWorkspaceId());
      const storedWorkspace = availableWorkspaces.find(
        (workspace) => workspace.companyId === storedId,
      );
      const selectionIsStale = Boolean(storedId && !storedWorkspace);
      const target =
        storedWorkspace ??
        (!selectionIsStale && availableWorkspaces.length === 1 ? availableWorkspaces[0] : null);
      if (!target) {
        await sessionService.clearSelectedWorkspaceId();
        setSelectedWorkspaceId(null);
        setWorkspacePermissionStatus('idle');
        return false;
      }
      return await activateWorkspace(target, token);
    } catch (refreshError) {
      if (requestId !== workspaceRequest.current) return false;
      setWorkspacePermissionStatus('error');
      setWorkspaceError(workspaceErrorMessage(refreshError));
      return false;
    }
  };

  const logout = useCallback(async () => {
    clearConversationDrafts().forEach((draft) => deleteTemporaryConversationFiles(draft.files));
    await sessionService.logout();
    clearWorkspaceState();
    setUser(null);
    setError(null);
    setStatus('signed-out');
  }, [clearWorkspaceState]);

  const refreshUser = useCallback(
    async (signal?: AbortSignal): Promise<MobileUser> => {
      if (!user?.id) throw new ApiError('No active account.', 401);
      const userId = user.id;
      const token = await sessionService.getAccessToken();
      const response = await sessionService.getMe(token, signal);
      if (signal?.aborted) return response.data.user;
      const activeToken = await sessionService.getAccessToken();
      if (activeToken !== token || response.data.user.id !== userId) {
        throw new ApiError('The signed-in account changed. Please try again.', 401);
      }
      setUser((current) => (current?.id === userId ? response.data.user : current));
      return response.data.user;
    },
    [user],
  );

  const applyUserProfileUpdate = useCallback(
    (
      userId: string,
      updates: Partial<Pick<MobileUser, 'firstName' | 'lastName' | 'bio' | 'profilePictureUrl'>>,
    ) => {
      setUser((current) => (current?.id === userId ? { ...current, ...updates } : current));
    },
    [],
  );

  const value: AuthContextValue = {
    status,
    user,
    workspaces,
    activeWorkspace,
    selectedWorkspaceId,
    permissions,
    workspacePermissionStatus,
    workspaceError,
    error,
    restore,
    login,
    logout,
    refreshUser,
    applyUserProfileUpdate,
    selectWorkspace,
    refreshWorkspaces,
    clearError: () => setError(null),
    clearWorkspaceError: () => setWorkspaceError(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
