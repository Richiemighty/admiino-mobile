import { randomUUID } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  AtSign,
  FileText,
  MessageCircle,
  Paperclip,
  Reply,
  Send,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  TextInput,
  View,
} from 'react-native';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import {
  AppButton,
  AppCard,
  AppScreen,
  AppText,
  IconButton,
  InlineError,
  LoadingState,
  UserAvatar,
} from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import {
  clearConversationDraft,
  clearWorkspaceConversationDrafts,
  conversationDraftKey,
  getConversationDraft,
  type PickedConversationFile,
  saveConversationDraft,
  type TaskConversationDraft,
} from './conversationDraft';
import { type TaskComment, taskConversationService } from './conversationService';
import { MAX_COMMENT_FILES, validateTaskFile } from './fileContracts';
import { type TaskDetails, type TaskPerson, taskService } from './service';

const EMPTY_DRAFT: TaskConversationDraft = {
  content: '',
  parentCommentId: null,
  mentionedUserIds: [],
  mentionLabels: {},
  files: [],
  clientMessageId: null,
  attemptedContent: null,
  attemptedParentCommentId: null,
};

let previousConversationWorkspaceId: string | null = null;

function personName(person: TaskPerson | null | undefined): string {
  if (!person) return 'Former member';
  return [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || 'Workspace member';
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatFileSize(size: number | null | undefined): string {
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function conversationError(error: unknown): string {
  if (error instanceof ApiNetworkError) return 'You appear to be offline. Reconnect and try again.';
  if (error instanceof ApiTimeoutError)
    return 'The conversation request timed out. Please try again.';
  if (error instanceof ApiError && error.status === 403)
    return 'You no longer have permission to access this conversation.';
  if (error instanceof ApiError && error.status === 404)
    return 'This task or conversation is no longer available in the active workspace.';
  if (error instanceof ApiError && error.status === 423)
    return 'This workspace is temporarily suspended.';
  return 'The conversation could not be loaded. Please try again.';
}

function sendErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError || error instanceof ApiTimeoutError) {
    return 'Delivery is unconfirmed. Check the conversation before retrying to avoid a duplicate.';
  }
  if (error instanceof ApiError && error.status === 401)
    return 'Your session has expired. Sign in again to continue.';
  if (error instanceof ApiError && error.status === 403)
    return 'You no longer have permission to comment on this task.';
  if (error instanceof ApiError && error.status === 404) return 'This task is no longer available.';
  if (error instanceof ApiError && error.status === 413)
    return 'The selected file is too large. Each file must be 20 MB or smaller.';
  if (error instanceof ApiError && error.status === 423)
    return 'This workspace is temporarily suspended.';
  if (error instanceof ApiError && error.status === 429)
    return 'Too many requests. Wait a moment and try again.';
  if (error instanceof ApiError && error.status >= 500)
    return 'The server could not confirm delivery. Check the conversation before retrying.';
  if (error instanceof ApiError && error.status >= 400) return error.message;
  return 'The comment could not be sent. Please try again.';
}

function mergeComments(existing: TaskComment[], incoming: TaskComment[]): TaskComment[] {
  const merged = [...existing];
  for (const comment of incoming) {
    const clientMessageId = comment.metadata.clientMessageId;
    const index = merged.findIndex(
      (candidate) =>
        candidate.id === comment.id ||
        (clientMessageId && candidate.metadata.clientMessageId === clientMessageId),
    );
    if (index >= 0) merged[index] = comment;
    else merged.push(comment);
  }
  return merged.sort((left, right) => {
    const difference = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    return Number.isFinite(difference) ? difference : 0;
  });
}

async function latestComments(taskId: string, workspaceId: string, signal?: AbortSignal) {
  const first = await taskConversationService.getComments(taskId, workspaceId, 50, 0, signal);
  if (first.total <= first.limit) return first;

  let page = await taskConversationService.getComments(
    taskId,
    workspaceId,
    first.limit,
    Math.max(0, first.total - first.limit),
    signal,
  );
  while (page.hasMore) {
    page = await taskConversationService.getComments(
      taskId,
      workspaceId,
      first.limit,
      page.offset + page.limit,
      signal,
    );
  }
  return page;
}

function deleteTemporaryFiles(files: PickedConversationFile[]) {
  for (const item of files) {
    try {
      const file = new File(item.uri);
      if (file.exists) file.delete();
    } catch {
      console.warn('Unable to remove a temporary conversation attachment.');
    }
  }
}

function localUploadFile(item: PickedConversationFile) {
  return {
    file: new File(item.uri),
    name: item.name,
    mimeType: item.mimeType,
    size: item.size,
  };
}

function createPendingComment(
  taskId: string,
  user: { id: string; firstName?: string; lastName?: string } | null,
  draft: TaskConversationDraft,
): TaskComment | null {
  if (!draft.clientMessageId || !draft.attemptedContent) return null;
  return {
    id: `pending-${draft.clientMessageId}`,
    taskId,
    userId: user?.id ?? '',
    content: draft.attemptedContent,
    isSystemMessage: false,
    parentCommentId: draft.attemptedParentCommentId,
    createdAt: new Date().toISOString(),
    user: user ? { id: user.id, firstName: user.firstName, lastName: user.lastName } : null,
    metadata: { clientMessageId: draft.clientMessageId },
    attachments: draft.files.map((file, index) => ({
      id: `pending-file-${index}`,
      fileName: file.name,
      fileType: file.mimeType,
      fileSize: file.size,
    })),
  };
}

function CommentItem({
  comment,
  currentUserId,
  pendingStatus,
  parent,
  canReply,
  onReply,
  onOpenAttachment,
  onRetry,
}: {
  comment: TaskComment;
  currentUserId: string | null;
  pendingStatus?: 'sending' | 'uncertain';
  parent?: TaskComment;
  canReply: boolean;
  onReply: (comment: TaskComment) => void;
  onOpenAttachment: (comment: TaskComment, attachment: TaskComment['attachments'][number]) => void;
  onRetry: (clientMessageId: string) => void;
}) {
  const { colors } = useAppTheme();
  const isPending = comment.id.startsWith('pending-');
  const author = isPending && currentUserId === comment.userId ? 'You' : personName(comment.user);
  const clientMessageId = comment.metadata.clientMessageId;

  if (comment.isSystemMessage) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: themeTokens.spacing.xs }}>
        <AppText tone="secondary" variant="caption">
          {comment.content}
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: themeTokens.spacing.xs }}>
      <UserAvatar name={author} size={32} />
      <View style={{ flex: 1, gap: themeTokens.spacing.xxs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.xs }}>
          <AppText numberOfLines={1} style={{ flexShrink: 1 }} variant="label">
            {author}
          </AppText>
          <AppText numberOfLines={1} style={{ flexShrink: 0 }} tone="secondary" variant="caption">
            {formatTime(comment.createdAt)}
          </AppText>
        </View>
        <View
          style={{
            alignSelf: 'flex-start',
            maxWidth: '100%',
            borderRadius: themeTokens.radius.md,
            backgroundColor:
              comment.userId === currentUserId ? colors.primarySurface : colors.surfaceSubtle,
            paddingHorizontal: themeTokens.spacing.sm,
            paddingVertical: themeTokens.spacing.xs,
          }}
        >
          {comment.parentCommentId && (
            <AppText
              numberOfLines={2}
              style={{ marginBottom: themeTokens.spacing.xxs }}
              tone="secondary"
              variant="caption"
            >
              Replying to {parent ? personName(parent.user) : 'an earlier comment'}
              {parent ? `: ${parent.content.slice(0, 90)}` : ''}
            </AppText>
          )}
          <AppText selectable style={{ lineHeight: 21 }}>
            {comment.content}
          </AppText>
          {comment.attachments.map((attachment) => (
            <Pressable
              accessibilityLabel={`Open attachment ${attachment.fileName ?? attachment.name ?? 'file'}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: isPending }}
              disabled={isPending}
              key={attachment.id}
              onPress={() => onOpenAttachment(comment, attachment)}
              style={({ pressed }) => ({
                minHeight: themeTokens.touchTarget.minimum,
                flexDirection: 'row',
                alignItems: 'center',
                gap: themeTokens.spacing.xs,
                marginTop: themeTokens.spacing.xs,
                borderRadius: themeTokens.radius.sm,
                backgroundColor: pressed ? colors.surface : colors.surface,
                paddingHorizontal: themeTokens.spacing.xs,
              })}
            >
              <FileText color={colors.primaryAction} size={16} />
              <AppText numberOfLines={1} style={{ flexShrink: 1 }} variant="caption">
                {attachment.fileName ?? attachment.name ?? 'Attachment'}
              </AppText>
              {attachment.fileSize != null && (
                <AppText tone="secondary" variant="caption">
                  {formatFileSize(attachment.fileSize)}
                </AppText>
              )}
            </Pressable>
          ))}
        </View>
        {pendingStatus && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.xs }}>
            <AppText
              accessibilityLiveRegion="polite"
              tone={pendingStatus === 'sending' ? 'secondary' : 'warning'}
              variant="caption"
            >
              {pendingStatus === 'sending' ? 'Sending…' : 'Delivery unconfirmed'}
            </AppText>
            {pendingStatus === 'uncertain' && clientMessageId && (
              <Pressable
                accessibilityLabel="Check delivery and retry comment"
                accessibilityRole="button"
                onPress={() => onRetry(clientMessageId)}
                style={{ minHeight: themeTokens.touchTarget.minimum, justifyContent: 'center' }}
              >
                <AppText tone="primary" variant="caption">
                  Check and retry
                </AppText>
              </Pressable>
            )}
          </View>
        )}
        {!isPending && canReply && (
          <Pressable
            accessibilityLabel={`Reply to ${author}'s comment`}
            accessibilityRole="button"
            onPress={() => onReply(comment)}
            style={{
              minHeight: themeTokens.touchTarget.minimum,
              flexDirection: 'row',
              alignItems: 'center',
              gap: themeTokens.spacing.xxs,
              alignSelf: 'flex-start',
            }}
          >
            <Reply color={colors.textMuted} size={15} />
            <AppText tone="secondary" variant="caption">
              Reply
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function TaskConversationScreen({
  taskId,
  returnProjectId,
  returnToInbox = false,
  directFromInbox = false,
  commentId,
}: {
  taskId: string;
  returnProjectId?: string;
  returnToInbox?: boolean;
  directFromInbox?: boolean;
  commentId?: string;
}) {
  const { activeWorkspace, status, workspacePermissionStatus, user, logout } = useAuth();
  const { colors } = useAppTheme();
  const workspaceId = activeWorkspace?.companyId ?? null;
  const isReady =
    status === 'authenticated' &&
    workspacePermissionStatus === 'ready' &&
    Boolean(workspaceId && taskId);
  const draftKey =
    user?.id && workspaceId && taskId ? conversationDraftKey(user.id, workspaceId, taskId) : '';
  const initialDraft = useMemo(
    () => (draftKey ? (getConversationDraft(draftKey) ?? { ...EMPTY_DRAFT }) : { ...EMPTY_DRAFT }),
    [draftKey],
  );
  const [draftState, setDraftState] = useState<{
    key: string;
    value: TaskConversationDraft;
  }>(() => ({
    key: draftKey,
    value: initialDraft,
  }));
  const draft = draftState.key === draftKey ? draftState.value : initialDraft;
  const draftRef = useRef(draft);
  const [loaded, setLoaded] = useState<{
    workspaceId: string;
    taskId: string;
    details: TaskDetails;
  } | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const commentsRef = useRef(comments);
  const earliestOffsetRef = useRef(0);
  const hasLoadedConversation = useRef(false);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [pendingComments, setPendingComments] = useState<TaskComment[]>([]);
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, 'sending' | 'uncertain'>>(
    {},
  );
  const [filesError, setFilesError] = useState<string | null>(null);
  const [mentionCandidates, setMentionCandidates] = useState<TaskPerson[]>([]);
  const [loadingMentions, setLoadingMentions] = useState(false);
  const [mentionsError, setMentionsError] = useState<string | null>(null);
  const [mentionsLoaded, setMentionsLoaded] = useState(false);
  const listRef = useRef<FlatList<TaskComment>>(null);
  const loadController = useRef<AbortController | null>(null);
  const refreshController = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const shouldScrollToBottom = useRef(false);
  const loadedRef = useRef(loaded);
  const contextIdentity = `${workspaceId ?? ''}:${taskId}:${user?.id ?? ''}`;
  const contextRef = useRef(contextIdentity);
  const loadedConversation =
    loaded?.workspaceId === workspaceId && loaded.taskId === taskId ? loaded : null;
  const task = loadedConversation?.details.task ?? null;
  const access = loadedConversation?.details.access ?? null;
  const canComment =
    access?.canCollaborate === true || (access?.canEdit === true && access.readOnly === false);
  const rows = [
    ...comments,
    ...pendingComments.filter(
      (comment) =>
        !comments.some(
          (saved) =>
            saved.id === comment.id ||
            (comment.metadata.clientMessageId &&
              saved.metadata.clientMessageId === comment.metadata.clientMessageId),
        ),
    ),
  ].sort((left, right) => {
    const difference = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    return Number.isFinite(difference) ? difference : 0;
  });
  const mentionMatch = /(?:^|\s)@([\w .'-]*)$/.exec(draft.content);
  const mentionQuery = mentionMatch?.[1] ?? null;
  const visibleMentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.trim().toLowerCase();
    return mentionCandidates
      .filter((person) => {
        const name = personName(person).toLowerCase();
        return !query || name.includes(query);
      })
      .slice(0, 6);
  }, [mentionCandidates, mentionQuery]);

  const setDraftValue = useCallback(
    (next: TaskConversationDraft) => {
      draftRef.current = next;
      setDraftState({ key: draftKey, value: next });
      if (draftKey) saveConversationDraft(draftKey, next);
    },
    [draftKey],
  );

  const loadMentionCandidates = useCallback(async () => {
    if (!task || !workspaceId || mentionsLoaded || loadingMentions) return;
    const requestContext = contextIdentity;
    const known = [task.creator, task.assignee, ...(task.assignees ?? [])].filter(
      (person): person is TaskPerson => Boolean(person?.id),
    );
    const byId = new Map(known.map((person) => [person.id, person]));
    setLoadingMentions(true);
    setMentionsError(null);
    try {
      if (task.teamId) {
        const [teamsResult, membersResult] = await Promise.allSettled([
          taskService.getTeams(workspaceId),
          taskService.getMembers(workspaceId),
        ]);
        if (teamsResult.status === 'rejected') throw teamsResult.reason;
        if (membersResult.status === 'rejected') throw membersResult.reason;
        const eligibleIds = new Set(
          teamsResult.value.find((team) => team.id === task.teamId)?.memberIds ?? [],
        );
        membersResult.value
          .filter((member) => eligibleIds.has(member.userId))
          .forEach((member) =>
            byId.set(member.userId, {
              id: member.userId,
              firstName: member.firstName,
              lastName: member.lastName,
            }),
          );
      }
      if (contextRef.current === requestContext) {
        setMentionCandidates([...byId.values()]);
        setMentionsLoaded(true);
      }
    } catch {
      if (contextRef.current === requestContext) {
        setMentionCandidates([...byId.values()]);
        setMentionsError('Colleague suggestions are unavailable. You can still send a comment.');
        setMentionsLoaded(true);
      }
    } finally {
      if (contextRef.current === requestContext) setLoadingMentions(false);
    }
  }, [contextIdentity, loadingMentions, mentionsLoaded, task, workspaceId]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    contextRef.current = contextIdentity;
  }, [contextIdentity]);

  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  useEffect(() => {
    if (previousConversationWorkspaceId && previousConversationWorkspaceId !== workspaceId) {
      const staleDrafts = clearWorkspaceConversationDrafts(previousConversationWorkspaceId);
      staleDrafts.forEach((value) => deleteTemporaryFiles(value.files));
    }
    previousConversationWorkspaceId = workspaceId;
  }, [workspaceId]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadController.current?.abort();
      refreshController.current?.abort();
    };
  }, []);

  const returnToTask = useCallback(() => {
    if (directFromInbox) {
      router.replace('/(tabs)/inbox');
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace({
      pathname: '/tasks/[id]',
      params: {
        id: taskId,
        ...(returnProjectId ? { projectId: returnProjectId, fromProject: '1' } : {}),
        ...(returnToInbox ? { returnTo: 'inbox' } : {}),
      },
    });
  }, [directFromInbox, returnProjectId, returnToInbox, taskId]);

  const clearPrivateConversation = useCallback(() => {
    setComments([]);
    commentsRef.current = [];
    setPendingComments([]);
    setPendingStatuses({});
    setLoaded(null);
    loadedRef.current = null;
    if (draftKey) {
      const removed = clearConversationDraft(draftKey);
      if (removed) deleteTemporaryFiles(removed.files);
    }
    draftRef.current = { ...EMPTY_DRAFT };
    setDraftState({ key: draftKey, value: { ...EMPTY_DRAFT } });
  }, [draftKey]);

  const applyApiFailure = useCallback(
    async (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        clearPrivateConversation();
        try {
          await logout();
          router.replace('/sign-in');
        } catch {
          setLoadError('Your session could not be cleared safely. Please try again.');
        }
      } else if (error instanceof ApiError && error.status === 423) {
        clearPrivateConversation();
        router.replace('/workspace-suspended');
      } else {
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
          clearPrivateConversation();
        }
        setLoadError(conversationError(error));
      }
    },
    [clearPrivateConversation, logout],
  );

  const reconcileDraftWithComments = useCallback(
    (serverComments: TaskComment[]) => {
      const currentDraft = draftRef.current;
      const clientMessageId = currentDraft.clientMessageId;
      if (!clientMessageId || !currentDraft.attemptedContent) return;
      const delivered = serverComments.some(
        (comment) => comment.metadata.clientMessageId === clientMessageId,
      );
      if (delivered) {
        setPendingComments((current) =>
          current.filter((comment) => comment.metadata.clientMessageId !== clientMessageId),
        );
        setPendingStatuses((current) => {
          const next = { ...current };
          delete next[clientMessageId];
          return next;
        });
        if (draftKey) {
          const saved = clearConversationDraft(draftKey);
          if (saved) deleteTemporaryFiles(saved.files);
        }
        setDraftValue({ ...EMPTY_DRAFT });
        return;
      }

      const pending = createPendingComment(taskId, user, currentDraft);
      if (!pending) return;
      setPendingComments((current) =>
        current.some((comment) => comment.metadata.clientMessageId === clientMessageId)
          ? current
          : [...current, pending],
      );
      setPendingStatuses((current) =>
        current[clientMessageId] === 'sending'
          ? current
          : { ...current, [clientMessageId]: 'uncertain' },
      );
    },
    [draftKey, setDraftValue, taskId, user],
  );

  const refreshConversation = useCallback(
    async (showInitial = false) => {
      if (!isReady || !workspaceId || !taskId) return null;
      refreshController.current?.abort();
      const controller = new AbortController();
      refreshController.current = controller;
      loadController.current = controller;
      const showLoading = showInitial && !hasLoadedConversation.current;
      setLoadError(null);
      if (showLoading) setLoading(true);
      else setRefreshing(true);

      try {
        const details = await taskService.getTask(taskId, workspaceId, controller.signal);
        const latest = await latestComments(taskId, workspaceId, controller.signal);
        if (controller.signal.aborted || !mounted.current) return null;

        const nextLoaded = { workspaceId, taskId, details };
        const sameContext =
          loadedRef.current?.workspaceId === workspaceId && loadedRef.current.taskId === taskId;
        const currentComments = sameContext ? commentsRef.current : [];
        const merged = mergeComments(currentComments, latest.comments);
        reconcileDraftWithComments(latest.comments);
        loadedRef.current = nextLoaded;
        setLoaded(nextLoaded);
        setComments(merged);
        commentsRef.current = merged;
        if (!hasLoadedConversation.current) {
          hasLoadedConversation.current = true;
          earliestOffsetRef.current = latest.offset;
          setHasEarlier(latest.offset > 0);
          shouldScrollToBottom.current = true;
        }
        return latest;
      } catch (error) {
        if (!controller.signal.aborted && mounted.current) await applyApiFailure(error);
        return null;
      } finally {
        if (!controller.signal.aborted && mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [applyApiFailure, isReady, reconcileDraftWithComments, taskId, workspaceId],
  );

  useFocusEffect(
    useCallback(() => {
      if (!isReady || !workspaceId || !taskId) return undefined;
      void refreshConversation(true);
      const subscription = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') void refreshConversation(false);
      });
      return () => {
        subscription.remove();
        loadController.current?.abort();
        refreshController.current?.abort();
      };
    }, [isReady, refreshConversation, taskId, workspaceId]),
  );

  useEffect(() => {
    if (shouldScrollToBottom.current && rows.length) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
      shouldScrollToBottom.current = false;
    }
  }, [rows.length]);

  const loadEarlier = useCallback(async () => {
    if (!workspaceId || !taskId || loadingEarlier || earliestOffsetRef.current <= 0) return;
    const offset = Math.max(0, earliestOffsetRef.current - 50);
    const controller = new AbortController();
    loadController.current?.abort();
    loadController.current = controller;
    setLoadingEarlier(true);
    setLoadError(null);
    try {
      const page = await taskConversationService.getComments(
        taskId,
        workspaceId,
        50,
        offset,
        controller.signal,
      );
      if (
        controller.signal.aborted ||
        !mounted.current ||
        loadedRef.current?.workspaceId !== workspaceId ||
        loadedRef.current.taskId !== taskId
      )
        return;
      const merged = mergeComments(page.comments, commentsRef.current);
      setComments(merged);
      commentsRef.current = merged;
      reconcileDraftWithComments(page.comments);
      earliestOffsetRef.current = page.offset;
      setHasEarlier(page.offset > 0);
    } catch (error) {
      if (!controller.signal.aborted) await applyApiFailure(error);
    } finally {
      if (!controller.signal.aborted) setLoadingEarlier(false);
    }
  }, [applyApiFailure, loadingEarlier, reconcileDraftWithComments, taskId, workspaceId]);

  const reconcileMessage = useCallback(
    async (clientMessageId: string) => {
      if (!workspaceId || !taskId) return null;
      const page = await latestComments(taskId, workspaceId);
      if (
        !mounted.current ||
        loadedRef.current?.workspaceId !== workspaceId ||
        loadedRef.current.taskId !== taskId
      )
        return null;
      const merged = mergeComments(commentsRef.current, page.comments);
      setComments(merged);
      commentsRef.current = merged;
      reconcileDraftWithComments(page.comments);
      const matching = page.comments.find(
        (comment) => comment.metadata.clientMessageId === clientMessageId,
      );
      return matching ?? null;
    },
    [reconcileDraftWithComments, taskId, workspaceId],
  );

  const sendCurrentDraft = useCallback(
    async (retryClientMessageId?: string) => {
      if (!canComment || sending || !workspaceId || !taskId || !user) return;
      const currentDraft = draftRef.current;
      const content = currentDraft.content.trim();
      if (!content) {
        setSendError('Write a comment before sending.');
        return;
      }
      const activePending = pendingComments.find(
        (comment) =>
          comment.metadata.clientMessageId &&
          pendingStatuses[comment.metadata.clientMessageId] === 'uncertain',
      );
      if (activePending && !retryClientMessageId) {
        setSendError('Check the status of the previous comment before sending another.');
        return;
      }

      const clientMessageId =
        retryClientMessageId ??
        (currentDraft.clientMessageId &&
        currentDraft.attemptedContent === content &&
        currentDraft.attemptedParentCommentId === currentDraft.parentCommentId
          ? currentDraft.clientMessageId
          : randomUUID());
      const pending = createPendingComment(taskId, user, {
        ...currentDraft,
        clientMessageId,
        attemptedContent: content,
        attemptedParentCommentId: currentDraft.parentCommentId,
      });
      if (!pending) return;
      const sendingDraft = {
        ...currentDraft,
        clientMessageId,
        attemptedContent: content,
        attemptedParentCommentId: currentDraft.parentCommentId,
      };
      setDraftValue(sendingDraft);
      setSendError(null);
      setPendingComments((current) =>
        current.some((comment) => comment.metadata.clientMessageId === clientMessageId)
          ? current.map((comment) =>
              comment.metadata.clientMessageId === clientMessageId ? pending : comment,
            )
          : [...current, pending],
      );
      setPendingStatuses((current) => ({ ...current, [clientMessageId]: 'sending' }));
      setSending(true);
      shouldScrollToBottom.current = true;
      const sendingContext = contextIdentity;

      const mentionedUserIds = sendingDraft.mentionedUserIds.filter((id) => {
        const label = sendingDraft.mentionLabels[id];
        return Boolean(label && content.includes(label));
      });

      try {
        const result = await taskConversationService.addComment(taskId, workspaceId, {
          content,
          clientMessageId,
          parentCommentId: sendingDraft.parentCommentId,
          mentionedUserIds,
          files: sendingDraft.files.map(localUploadFile),
        });
        if (!mounted.current || contextRef.current !== sendingContext) return;
        setComments((current) => mergeComments(current, [result.comment]));
        commentsRef.current = mergeComments(commentsRef.current, [result.comment]);
        setPendingComments((current) =>
          current.filter((comment) => comment.metadata.clientMessageId !== clientMessageId),
        );
        setPendingStatuses((current) => {
          const next = { ...current };
          delete next[clientMessageId];
          return next;
        });
        if (draftKey) {
          const saved = clearConversationDraft(draftKey);
          if (saved) deleteTemporaryFiles(saved.files);
        }
        setDraftValue({ ...EMPTY_DRAFT });
        setSendError(null);
      } catch (error) {
        if (!mounted.current || contextRef.current !== sendingContext) return;
        if (
          error instanceof ApiError &&
          (error.status === 401 ||
            error.status === 403 ||
            error.status === 404 ||
            error.status === 423)
        ) {
          setPendingComments((current) =>
            current.filter((comment) => comment.metadata.clientMessageId !== clientMessageId),
          );
          setPendingStatuses((current) => {
            const next = { ...current };
            delete next[clientMessageId];
            return next;
          });
          setDraftValue({
            ...sendingDraft,
            clientMessageId: null,
            attemptedContent: null,
            attemptedParentCommentId: null,
          });
          setSendError(sendErrorMessage(error));
          if (error.status === 401 || error.status === 423 || error.status === 404) {
            await applyApiFailure(error);
          }
          return;
        }
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          setPendingComments((current) =>
            current.filter((comment) => comment.metadata.clientMessageId !== clientMessageId),
          );
          setPendingStatuses((current) => {
            const next = { ...current };
            delete next[clientMessageId];
            return next;
          });
          setDraftValue({
            ...sendingDraft,
            clientMessageId: null,
            attemptedContent: null,
            attemptedParentCommentId: null,
          });
          setSendError(sendErrorMessage(error));
          return;
        }

        setPendingStatuses((current) => ({ ...current, [clientMessageId]: 'uncertain' }));
        setSendError(sendErrorMessage(error));
        try {
          await reconcileMessage(clientMessageId);
        } catch (reconcileError) {
          if (
            reconcileError instanceof ApiError &&
            [401, 403, 404, 423].includes(reconcileError.status)
          ) {
            await applyApiFailure(reconcileError);
          } else {
            setPendingStatuses((current) => ({ ...current, [clientMessageId]: 'uncertain' }));
          }
        }
      } finally {
        if (mounted.current && contextRef.current === sendingContext) setSending(false);
      }
    },
    [
      applyApiFailure,
      canComment,
      contextIdentity,
      draftKey,
      pendingComments,
      pendingStatuses,
      reconcileMessage,
      sending,
      setDraftValue,
      taskId,
      user,
      workspaceId,
    ],
  );

  const onRetryComment = useCallback(
    async (clientMessageId: string) => {
      setSendError(null);
      try {
        const delivered = await reconcileMessage(clientMessageId);
        if (delivered) {
          setSendError(null);
          return;
        }
        await sendCurrentDraft(clientMessageId);
      } catch (error) {
        setSendError(sendErrorMessage(error));
      }
    },
    [reconcileMessage, sendCurrentDraft],
  );

  const selectCommentFiles = useCallback(async () => {
    if (!canComment) return;
    const selectionContext = contextIdentity;
    setFilesError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      if (draftRef.current.files.length + result.assets.length > MAX_COMMENT_FILES) {
        setFilesError(`Attach no more than ${MAX_COMMENT_FILES} files to a comment.`);
        return;
      }

      const selected: PickedConversationFile[] = result.assets.map((asset) => {
        const file = new File(asset.uri);
        const mimeType = asset.mimeType ?? file.type ?? '';
        const size = asset.size ?? file.size;
        validateTaskFile(asset.name, mimeType, size);
        return { uri: asset.uri, name: asset.name, mimeType, size };
      });
      if (contextRef.current !== selectionContext) {
        deleteTemporaryFiles(selected);
        return;
      }
      const existingUris = new Set(draftRef.current.files.map((file) => file.uri));
      const uniqueFiles = selected.filter((file) => !existingUris.has(file.uri));
      setDraftValue({ ...draftRef.current, files: [...draftRef.current.files, ...uniqueFiles] });
    } catch (error) {
      setFilesError(
        error instanceof ApiError
          ? error.message
          : 'The selected files could not be read. Choose them again and retry.',
      );
    }
  }, [canComment, contextIdentity, setDraftValue]);

  const removeCommentFile = (uri: string) => {
    const removed = draftRef.current.files.find((file) => file.uri === uri);
    setDraftValue({
      ...draftRef.current,
      files: draftRef.current.files.filter((file) => file.uri !== uri),
    });
    if (removed) deleteTemporaryFiles([removed]);
  };

  const chooseReply = (comment: TaskComment) => {
    setDraftValue({ ...draftRef.current, parentCommentId: comment.id });
    setSendError(null);
  };

  const selectMention = (person: TaskPerson) => {
    const name = personName(person);
    const matched = /(^|\s)@([\w .'-]*)$/.exec(draftRef.current.content);
    const updatedContent = matched
      ? `${draftRef.current.content.slice(0, matched.index + matched[1].length)}@${name} `
      : `${draftRef.current.content}@${name} `;
    setDraftValue({
      ...draftRef.current,
      content: updatedContent,
      mentionedUserIds: [...new Set([...draftRef.current.mentionedUserIds, person.id])],
      mentionLabels: { ...draftRef.current.mentionLabels, [person.id]: `@${name}` },
    });
  };

  const openAttachment = (comment: TaskComment, attachment: TaskComment['attachments'][number]) => {
    if (!attachment.id) return;
    router.push({
      pathname: '/file-viewer',
      params: {
        taskId,
        attachmentId: attachment.id,
        fileName: attachment.fileName ?? attachment.name ?? 'Task attachment',
        fileType: attachment.mimeType ?? attachment.fileType ?? '',
        fileSize: attachment.fileSize == null ? '' : String(attachment.fileSize),
        source: attachment.source ?? '',
        commentId: comment.id,
        ...(returnProjectId ? { projectId: returnProjectId, fromProject: '1' } : {}),
        ...(returnToInbox ? { returnTo: 'inbox' } : {}),
        ...(directFromInbox ? { fromInbox: '1' } : {}),
      },
    });
  };

  const linkedCommentIndex = commentId
    ? comments.findIndex((comment) => comment.id === commentId)
    : -1;

  useEffect(() => {
    if (linkedCommentIndex >= 0) {
      requestAnimationFrame(() =>
        listRef.current?.scrollToIndex({
          index: linkedCommentIndex,
          animated: false,
          viewPosition: 0.5,
        }),
      );
    }
  }, [linkedCommentIndex]);

  const loadOlderHeader = (
    <View style={{ gap: themeTokens.spacing.xs, paddingBottom: themeTokens.spacing.sm }}>
      {commentId && linkedCommentIndex < 0 && (
        <AppText style={{ textAlign: 'center' }} tone="secondary" variant="caption">
          {hasEarlier
            ? 'The linked comment is not in the loaded messages. Load earlier comments to find it.'
            : 'The linked comment is unavailable; showing the task conversation.'}
        </AppText>
      )}
      {hasEarlier ? (
        <AppButton
          accessibilityLabel="Load earlier comments"
          disabled={loadingEarlier}
          onPress={() => void loadEarlier()}
          variant="outline"
        >
          {loadingEarlier ? 'Loading earlier comments…' : 'Load earlier comments'}
        </AppButton>
      ) : rows.length ? (
        <AppText style={{ textAlign: 'center' }} tone="secondary" variant="caption">
          Beginning of conversation
        </AppText>
      ) : null}
    </View>
  );

  if (!isReady) {
    return (
      <AppScreen>
        <LoadingState label="Preparing task conversation" variant="fullScreen" />
      </AppScreen>
    );
  }

  if (loading && !loadedConversation) {
    return (
      <AppScreen>
        <LoadingState label="Loading task conversation" variant="fullScreen" />
      </AppScreen>
    );
  }

  return (
    <AppScreen keyboardAvoiding padding="sm">
      <View style={{ flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' }}>
        <View
          style={{
            minHeight: 48,
            flexDirection: 'row',
            alignItems: 'center',
            gap: themeTokens.spacing.xs,
            paddingBottom: themeTokens.spacing.xs,
          }}
        >
          <IconButton
            accessibilityLabel={directFromInbox ? 'Back to Inbox' : 'Back to task details'}
            icon={<ArrowLeft color={colors.text} size={22} />}
            onPress={returnToTask}
          />
          <View style={{ flex: 1 }}>
            <AppText numberOfLines={1} variant="label">
              {task?.title ?? 'Task'}
            </AppText>
            <AppText accessibilityRole="header" variant="caption">
              Conversation
            </AppText>
          </View>
          <MessageCircle color={colors.primaryAction} size={19} />
        </View>

        {loadError && (
          <InlineError
            message={loadError}
            onRetry={() => void refreshConversation(true)}
            retryLabel="Reload conversation"
          />
        )}

        <FlatList
          ref={listRef}
          contentContainerStyle={{
            flexGrow: 1,
            gap: themeTokens.spacing.sm,
            paddingTop: themeTokens.spacing.xs,
            paddingBottom: themeTokens.spacing.sm,
          }}
          data={rows}
          keyExtractor={(comment) => comment.id}
          ListEmptyComponent={
            loading ? (
              <LoadingState label="Loading comments" />
            ) : loadError ? (
              <View />
            ) : (
              <AppCard padding="md" style={{ alignItems: 'center', gap: themeTokens.spacing.xs }}>
                <MessageCircle color={colors.textMuted} size={24} />
                <AppText variant="label">No comments yet</AppText>
                <AppText style={{ textAlign: 'center' }} tone="secondary" variant="caption">
                  Start the conversation with a comment.
                </AppText>
              </AppCard>
            )
          }
          ListHeaderComponent={loadOlderHeader}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => listRef.current?.scrollToIndex({ index, animated: false }), 100);
          }}
          refreshControl={
            <RefreshControl
              onRefresh={() => void refreshConversation(false)}
              refreshing={refreshing}
              tintColor={colors.primaryAction}
            />
          }
          renderItem={({ item }) => {
            const parent = item.parentCommentId
              ? comments.find((comment) => comment.id === item.parentCommentId)
              : undefined;
            const clientMessageId = item.metadata.clientMessageId;
            return (
              <CommentItem
                canReply={canComment}
                comment={item}
                currentUserId={user?.id ?? null}
                onOpenAttachment={openAttachment}
                onReply={chooseReply}
                onRetry={(id) => void onRetryComment(id)}
                parent={parent}
                pendingStatus={clientMessageId ? pendingStatuses[clientMessageId] : undefined}
              />
            );
          }}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        />

        {sendError && (
          <InlineError
            message={sendError}
            onRetry={
              draft.clientMessageId && pendingStatuses[draft.clientMessageId] === 'uncertain'
                ? () => void onRetryComment(draft.clientMessageId as string)
                : undefined
            }
            retryLabel="Check and retry comment"
          />
        )}

        {canComment ? (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingTop: themeTokens.spacing.xs,
              gap: themeTokens.spacing.xs,
            }}
          >
            {draft.parentCommentId && (
              <View
                style={{
                  minHeight: 36,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: themeTokens.spacing.xs,
                  borderRadius: themeTokens.radius.sm,
                  backgroundColor: colors.surfaceSubtle,
                  paddingHorizontal: themeTokens.spacing.xs,
                }}
              >
                <AppText numberOfLines={1} style={{ flex: 1 }} tone="secondary" variant="caption">
                  Replying to{' '}
                  {personName(
                    comments.find((comment) => comment.id === draft.parentCommentId)?.user,
                  )}
                </AppText>
                <IconButton
                  accessibilityLabel="Cancel reply"
                  icon={<X color={colors.textMuted} size={18} />}
                  onPress={() => setDraftValue({ ...draftRef.current, parentCommentId: null })}
                />
              </View>
            )}

            {visibleMentionCandidates.length > 0 && (
              <View
                style={{
                  maxHeight: 180,
                  borderRadius: themeTokens.radius.md,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  overflow: 'hidden',
                }}
              >
                {visibleMentionCandidates.map((person) => (
                  <Pressable
                    accessibilityLabel={`Mention ${personName(person)}`}
                    accessibilityRole="button"
                    key={person.id}
                    onPress={() => selectMention(person)}
                    style={{
                      minHeight: themeTokens.touchTarget.minimum,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: themeTokens.spacing.xs,
                      paddingHorizontal: themeTokens.spacing.sm,
                    }}
                  >
                    <UserAvatar name={personName(person)} size={30} />
                    <AppText variant="caption">{personName(person)}</AppText>
                  </Pressable>
                ))}
              </View>
            )}
            {loadingMentions && (
              <AppText accessibilityLiveRegion="polite" tone="secondary" variant="caption">
                Loading task participants…
              </AppText>
            )}
            {mentionsError && (
              <AppText tone="warning" variant="caption">
                {mentionsError}
              </AppText>
            )}
            {filesError && (
              <AppText tone="warning" variant="caption">
                {filesError}
              </AppText>
            )}

            {draft.files.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: themeTokens.spacing.xs }}>
                {draft.files.map((file) => (
                  <View
                    key={file.uri}
                    style={{
                      minHeight: 36,
                      maxWidth: '100%',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: themeTokens.spacing.xxs,
                      borderRadius: themeTokens.radius.pill,
                      backgroundColor: colors.surfaceSubtle,
                      paddingLeft: themeTokens.spacing.sm,
                      paddingRight: themeTokens.spacing.xxs,
                    }}
                  >
                    <FileText color={colors.primaryAction} size={15} />
                    <AppText numberOfLines={1} style={{ maxWidth: 180 }} variant="caption">
                      {file.name} · {formatFileSize(file.size)}
                    </AppText>
                    <IconButton
                      accessibilityLabel={`Remove ${file.name}`}
                      icon={<X color={colors.textMuted} size={16} />}
                      onPress={() => removeCommentFile(file.uri)}
                    />
                  </View>
                ))}
              </View>
            )}

            <View
              style={{
                minHeight: 56,
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: themeTokens.spacing.xs,
                borderRadius: themeTokens.radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                padding: themeTokens.spacing.xs,
              }}
            >
              <IconButton
                accessibilityLabel="Attach files"
                disabled={sending || draft.files.length >= MAX_COMMENT_FILES}
                icon={<Paperclip color={colors.textMuted} size={19} />}
                onPress={() => void selectCommentFiles()}
              />
              <TextInput
                accessibilityLabel="Write a comment"
                editable={!sending}
                multiline
                onChangeText={(content) => {
                  setDraftValue({ ...draftRef.current, content });
                  if (/(?:^|\s)@([\w .'-]*)$/.test(content)) {
                    void loadMentionCandidates();
                  }
                }}
                placeholder="Write a comment..."
                placeholderTextColor={colors.textMuted}
                style={{
                  flex: 1,
                  minHeight: 42,
                  maxHeight: 132,
                  paddingHorizontal: themeTokens.spacing.xs,
                  paddingTop: 10,
                  paddingBottom: 8,
                  color: colors.text,
                  fontSize: 16,
                  textAlignVertical: 'top',
                }}
                value={draft.content}
              />
              {mentionQuery !== null && (
                <AtSign color={colors.primaryAction} size={17} style={{ marginBottom: 12 }} />
              )}
              <IconButton
                accessibilityLabel={sending ? 'Sending comment' : 'Send comment'}
                disabled={sending || !draft.content.trim()}
                icon={
                  sending ? (
                    <ActivityIndicator color={colors.primaryAction} />
                  ) : (
                    <Send color={colors.primaryAction} size={19} />
                  )
                }
                onPress={() => void sendCurrentDraft()}
              />
            </View>
          </View>
        ) : (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingVertical: themeTokens.spacing.sm,
            }}
          >
            <AppText tone="secondary" variant="caption">
              This conversation is read-only. Comment access is controlled by the task.
            </AppText>
          </View>
        )}
      </View>
    </AppScreen>
  );
}
