import { router } from 'expo-router';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { inboxService } from './service';

interface InboxCountValue {
  unreadCount: number | null;
  countError: string | null;
  refreshUnreadCount: () => Promise<void>;
}

interface CountSnapshot {
  workspaceId: string;
  unreadCount: number | null;
  countError: string | null;
}

const InboxCountContext = createContext<InboxCountValue | null>(null);

function messageFor(error: unknown): string {
  if (error instanceof ApiNetworkError) return 'Unread count is unavailable while you are offline.';
  if (error instanceof ApiTimeoutError) return 'Unread count took too long to load.';
  if (error instanceof ApiError && error.status === 403)
    return 'Unread count is unavailable for this workspace.';
  if (error instanceof ApiError && error.status === 423)
    return 'This workspace is temporarily suspended.';
  return 'Unread count could not be loaded.';
}

export function InboxCountProvider({ children }: PropsWithChildren) {
  const { activeWorkspace, logout } = useAuth();
  const workspaceId = activeWorkspace?.companyId ?? null;
  const currentWorkspace = useRef(workspaceId);
  const [snapshot, setSnapshot] = useState<CountSnapshot | null>(null);

  const refreshUnreadCount = useCallback(
    async (signal?: AbortSignal) => {
      if (!workspaceId) return;
      const requestWorkspaceId = workspaceId;
      try {
        const unreadCount = await inboxService.countWorkspaceUnread(requestWorkspaceId, signal);
        if (!signal?.aborted && currentWorkspace.current === requestWorkspaceId) {
          setSnapshot({
            workspaceId: requestWorkspaceId,
            unreadCount,
            countError:
              unreadCount === null ? 'Unread count is unavailable with current preferences.' : null,
          });
        }
      } catch (error) {
        if (signal?.aborted || currentWorkspace.current !== requestWorkspaceId) return;
        if (error instanceof ApiError && error.status === 401) {
          try {
            await logout();
            router.replace('/sign-in');
          } catch {
            setSnapshot({
              workspaceId: requestWorkspaceId,
              unreadCount: null,
              countError: 'Your session could not be cleared safely. Please try again.',
            });
          }
          return;
        }
        if (error instanceof ApiError && error.status === 423) {
          router.replace('/workspace-suspended');
        }
        setSnapshot({
          workspaceId: requestWorkspaceId,
          unreadCount: null,
          countError: messageFor(error),
        });
      }
    },
    [logout, workspaceId],
  );

  useEffect(() => {
    currentWorkspace.current = workspaceId;
    if (!workspaceId) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void refreshUnreadCount(controller.signal);
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [refreshUnreadCount, workspaceId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshUnreadCount();
    });
    return () => subscription.remove();
  }, [refreshUnreadCount]);

  const value: InboxCountValue = {
    unreadCount: snapshot?.workspaceId === workspaceId ? snapshot.unreadCount : null,
    countError: snapshot?.workspaceId === workspaceId ? snapshot.countError : null,
    refreshUnreadCount: () => refreshUnreadCount(),
  };

  return <InboxCountContext.Provider value={value}>{children}</InboxCountContext.Provider>;
}

export function useInboxCount(): InboxCountValue {
  const context = useContext(InboxCountContext);
  if (!context) throw new Error('useInboxCount must be used within InboxCountProvider.');
  return context;
}
