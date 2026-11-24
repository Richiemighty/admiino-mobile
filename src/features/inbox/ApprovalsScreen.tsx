import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, ChevronRight, ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, View } from 'react-native';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import {
  AppButton,
  AppCard,
  AppScreen,
  AppText,
  BottomSheet,
  InlineError,
  LoadingState,
} from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import {
  type AccessRequest,
  type JoinRequest,
  type PendingVerification,
  workspaceApprovalsService,
} from './approvalsService';

type ApprovalCategory = 'join' | 'verification' | 'permissions';
type ApprovalItem =
  | { kind: 'join'; value: JoinRequest }
  | { kind: 'verification'; value: PendingVerification }
  | { kind: 'permissions'; value: AccessRequest };

interface LoadedQueue {
  workspaceId: string;
  category: ApprovalCategory;
  items: ApprovalItem[];
  page: number;
  totalPages: number;
}

const CATEGORY_LABELS: Record<ApprovalCategory, string> = {
  join: 'Join requests',
  verification: 'Member verifications',
  permissions: 'Permission requests',
};

function isOwnerOrAdmin(role: string | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

function displayName(
  person: { firstName: string | null; lastName: string | null; email: string | null } | null,
) {
  if (!person) return 'Unavailable requester';
  return (
    [person.firstName, person.lastName].filter(Boolean).join(' ').trim() ||
    person.email ||
    'Workspace member'
  );
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function requestTitle(item: ApprovalItem): string {
  if (item.kind === 'join') return displayName(item.value.requester);
  if (item.kind === 'verification') return displayName(item.value.user);
  return item.value.permissionKey.replaceAll('_', ' ');
}

function requestSubtitle(item: ApprovalItem): string {
  if (item.kind === 'join') {
    return item.value.requester?.email || item.value.workspace?.name || 'Workspace join request';
  }
  if (item.kind === 'verification') {
    return item.value.user?.email || `Workspace membership · ${item.value.status}`;
  }
  return `Requested by ${displayName(item.value.requester)}`;
}

function requestDate(item: ApprovalItem): string {
  return dateLabel(item.value.createdAt);
}

function queueError(error: unknown): string {
  if (error instanceof ApiNetworkError)
    return 'You appear to be offline. Reconnect and try loading requests again.';
  if (error instanceof ApiTimeoutError) return 'Loading requests took too long. Please try again.';
  if (error instanceof ApiError && error.status === 403)
    return 'Your permission to review these requests has changed.';
  if (error instanceof ApiError && error.status === 404)
    return 'This request is no longer available in the active workspace.';
  if (error instanceof ApiError && error.status === 423)
    return 'This workspace is temporarily suspended.';
  if (error instanceof ApiError && error.status === 429)
    return 'Too many requests. Wait a moment, then try again.';
  return 'Requests could not be loaded. Please try again.';
}

function requestDateFor(item: ApprovalItem): string {
  return item.value.createdAt;
}

function canDecide(item: ApprovalItem): boolean {
  if (item.kind === 'verification')
    return !item.value.isVerified && item.value.status !== 'removed';
  return item.value.status === 'pending';
}

function categoryFromParam(value: string | undefined): ApprovalCategory | null {
  if (value === 'join' || value === 'verification' || value === 'permissions') return value;
  return null;
}

function SegmentedCategories({
  categories,
  value,
  onChange,
}: {
  categories: ApprovalCategory[];
  value: ApprovalCategory;
  onChange: (category: ApprovalCategory) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityLabel="Approval request category"
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        padding: 3,
        borderRadius: themeTokens.radius.pill,
        backgroundColor: colors.surfaceSubtle,
      }}
    >
      {categories.map((category) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: value === category }}
          key={category}
          onPress={() => onChange(category)}
          style={{
            flex: 1,
            minHeight: 40,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: themeTokens.radius.pill,
            backgroundColor: value === category ? colors.surface : 'transparent',
            paddingHorizontal: 4,
          }}
        >
          <AppText
            numberOfLines={1}
            tone={value === category ? 'primary' : 'secondary'}
            variant="caption"
          >
            {CATEGORY_LABELS[category]}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

export function ApprovalsScreen() {
  const {
    activeWorkspace,
    permissions,
    status,
    workspacePermissionStatus,
    logout,
    refreshWorkspaces,
  } = useAuth();
  const { category: categoryParam, requestId: requestIdParam } = useLocalSearchParams<{
    category?: string;
    requestId?: string;
  }>();
  const workspaceId = activeWorkspace?.companyId ?? null;
  const role = permissions?.role;
  const ownerAdmin = isOwnerOrAdmin(role);
  const categories = useMemo(
    () =>
      ownerAdmin
        ? (['join', 'verification', 'permissions'] as ApprovalCategory[])
        : role === 'manager'
          ? (['permissions'] as ApprovalCategory[])
          : [],
    [ownerAdmin, role],
  );
  const requestedCategory = categoryFromParam(
    Array.isArray(categoryParam) ? categoryParam[0] : categoryParam,
  );
  const requestId = Array.isArray(requestIdParam) ? requestIdParam[0] : requestIdParam;

  if (!workspaceId) {
    return (
      <AppScreen>
        <LoadingState label="Verifying workspace access" variant="fullScreen" />
      </AppScreen>
    );
  }
  return (
    <ApprovalQueue
      key={`${workspaceId}:${requestedCategory ?? ''}:${requestId ?? ''}`}
      categories={categories}
      isReady={status === 'authenticated' && workspacePermissionStatus === 'ready'}
      logout={logout}
      refreshWorkspaces={refreshWorkspaces}
      requestedCategory={requestedCategory}
      requestId={requestId}
      workspaceId={workspaceId}
    />
  );
}

function ApprovalQueue({
  workspaceId,
  categories,
  isReady,
  logout,
  refreshWorkspaces,
  requestedCategory,
  requestId,
}: {
  workspaceId: string;
  categories: ApprovalCategory[];
  isReady: boolean;
  logout: () => Promise<void>;
  refreshWorkspaces: () => Promise<boolean>;
  requestedCategory: ApprovalCategory | null;
  requestId?: string;
}) {
  const { colors } = useAppTheme();
  const [category, setCategory] = useState<ApprovalCategory>(
    requestedCategory && categories.includes(requestedCategory)
      ? requestedCategory
      : (categories[0] ?? 'permissions'),
  );
  const [loaded, setLoaded] = useState<LoadedQueue | null>(null);
  const [selected, setSelected] = useState<ApprovalItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const activeWorkspace = useRef<string | null>(workspaceId);
  const activeCategory = categories.includes(category)
    ? category
    : (categories[0] ?? 'permissions');
  const current =
    loaded?.workspaceId === workspaceId && loaded.category === activeCategory ? loaded : null;
  const items = current?.items ?? [];

  useEffect(() => {
    return () => {
      activeWorkspace.current = null;
      request.current?.abort();
    };
  }, []);

  const handleFatal = useCallback(
    async (requestError: unknown) => {
      if (requestError instanceof ApiError && requestError.status === 401) {
        try {
          await logout();
          router.replace('/sign-in');
        } catch {
          setError('Your session could not be cleared safely. Please try again.');
        }
        return true;
      }
      if (requestError instanceof ApiError && requestError.status === 423) {
        router.replace('/workspace-suspended');
      }
      if (requestError instanceof ApiError && requestError.status === 403) {
        void refreshWorkspaces();
      }
      return false;
    },
    [logout, refreshWorkspaces],
  );

  const loadQueue = useCallback(
    async (controller: AbortController, isRefresh: boolean) => {
      setLoading(!isRefresh);
      setRefreshing(isRefresh);
      setError(null);
      setNotice(null);
      try {
        let nextItems: ApprovalItem[];
        let totalPages = 1;
        if (activeCategory === 'join') {
          const result = await workspaceApprovalsService.listJoinRequests(workspaceId, {
            page,
            pageSize: 20,
            signal: controller.signal,
          });
          nextItems = result.requests.map((value) => ({ kind: 'join', value }));
          totalPages = result.totalPages;
          if (requestId) {
            try {
              const details = await workspaceApprovalsService.getJoinRequest(
                workspaceId,
                requestId,
                controller.signal,
              );
              if (!controller.signal.aborted) setSelected({ kind: 'join', value: details });
            } catch (detailError) {
              if (!(detailError instanceof ApiError && detailError.status === 404))
                throw detailError;
              setNotice('This join request is no longer available in the active workspace.');
            }
          }
        } else if (activeCategory === 'verification') {
          const result = await workspaceApprovalsService.listPendingVerifications(
            workspaceId,
            controller.signal,
          );
          nextItems = result.map((value) => ({ kind: 'verification', value }));
        } else {
          const result = await workspaceApprovalsService.listAccessRequests(
            workspaceId,
            controller.signal,
          );
          nextItems = result.map((value) => ({ kind: 'permissions', value }));
          if (requestId) {
            const detail = result.find((value) => value.id === requestId);
            if (detail) setSelected({ kind: 'permissions', value: detail });
            else setNotice('This permission request is no longer pending or available.');
          }
        }
        if (controller.signal.aborted || activeWorkspace.current !== workspaceId) return;
        setLoaded({ workspaceId, category: activeCategory, items: nextItems, page, totalPages });
      } catch (requestError) {
        if (controller.signal.aborted || activeWorkspace.current !== workspaceId) return;
        const handled = await handleFatal(requestError);
        if (!handled) setError(queueError(requestError));
      } finally {
        if (!controller.signal.aborted && activeWorkspace.current === workspaceId) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [activeCategory, handleFatal, page, requestId, workspaceId],
  );

  useFocusEffect(
    useCallback(() => {
      if (!isReady || !categories.includes(activeCategory)) return undefined;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      void loadQueue(controller, false);
      return () => {
        controller.abort();
        if (request.current === controller) request.current = null;
      };
    }, [activeCategory, categories, isReady, loadQueue]),
  );

  const refresh = () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    void loadQueue(controller, true);
  };

  const chooseCategory = (next: ApprovalCategory) => {
    setSelected(null);
    setPage(1);
    setCategory(next);
  };

  const decision = (item: ApprovalItem, action: 'approve' | 'reject') => {
    if (submitting.current || !canDecide(item)) return;
    const name = item.kind === 'verification' ? displayName(item.value.user) : requestTitle(item);
    let message: string;
    if (item.kind === 'join' && action === 'approve') {
      message = `${name} will become an active Member of this workspace. This does not grant Team or restricted Project access.`;
    } else if (item.kind === 'join') {
      message =
        'The request will be declined, and the requester will receive an outcome notification.';
    } else if (item.kind === 'verification' && action === 'approve') {
      message = `${name} will be verified and activated as a member of this workspace.`;
    } else if (item.kind === 'verification') {
      message =
        'The membership will be removed and the user account will be marked inactive across Admiino.';
    } else if (action === 'approve') {
      message = `Approving grants the requester the "${item.value.permissionKey.replaceAll('_', ' ')}" workspace permission.`;
    } else {
      message = 'The request will be denied without granting the requested workspace permission.';
    }

    Alert.alert(
      `${action === 'approve' ? 'Approve' : item.kind === 'join' ? 'Decline' : 'Reject'} request?`,
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'approve' ? 'Approve' : item.kind === 'join' ? 'Decline' : 'Reject',
          style: action === 'reject' ? 'destructive' : 'default',
          onPress: () => void submitDecision(item, action),
        },
      ],
    );
  };

  const submitDecision = async (item: ApprovalItem, action: 'approve' | 'reject') => {
    if (submitting.current || !canDecide(item)) return;
    submitting.current = true;
    setSavingId(item.value.id);
    setError(null);
    setNotice(null);
    try {
      if (item.kind === 'join') {
        await workspaceApprovalsService.decideJoinRequest(
          workspaceId,
          item.value.id,
          action === 'approve' ? 'approve' : 'decline',
        );
      } else if (item.kind === 'verification') {
        await workspaceApprovalsService.decideMemberVerification(
          workspaceId,
          item.value.userId,
          action,
        );
      } else {
        await workspaceApprovalsService.decideAccessRequest(
          workspaceId,
          item.value.id,
          action === 'approve' ? 'approve' : 'deny',
        );
      }
      if (activeWorkspace.current !== workspaceId) return;
      setSelected(null);
      const successMessage =
        action === 'approve'
          ? 'The request was approved.'
          : item.kind === 'join'
            ? 'The join request was declined.'
            : item.kind === 'verification'
              ? 'The pending membership was rejected.'
              : 'The permission request was denied.';
      if (item.kind === 'permissions' && action === 'approve') {
        await refreshWorkspaces();
      }
      if (activeWorkspace.current === workspaceId) {
        refresh();
        setNotice(successMessage);
      }
    } catch (requestError) {
      if (activeWorkspace.current !== workspaceId) return;
      if (requestError instanceof ApiError && requestError.status === 401) {
        await handleFatal(requestError);
      } else {
        if (requestError instanceof ApiError && [400, 409].includes(requestError.status)) {
          refresh();
          setNotice('This request may already have been processed. The queue is being refreshed.');
        } else {
          setError(queueError(requestError));
        }
        if (requestError instanceof ApiError && requestError.status === 403)
          await refreshWorkspaces();
      }
    } finally {
      submitting.current = false;
      if (activeWorkspace.current === workspaceId) setSavingId(null);
    }
  };

  const renderDetails = (item: ApprovalItem) => (
    <View style={{ gap: themeTokens.spacing.sm, paddingBottom: themeTokens.spacing.sm }}>
      <AppText variant="label">{requestTitle(item)}</AppText>
      <AppText tone="secondary" variant="caption">
        {requestSubtitle(item)}
      </AppText>
      <AppText tone="secondary" variant="caption">
        Requested {requestDateFor(item)}
      </AppText>
      {item.kind === 'join' && item.value.message ? (
        <View style={{ gap: 4 }}>
          <AppText variant="caption">Message</AppText>
          <AppText tone="secondary" variant="body">
            {item.value.message}
          </AppText>
        </View>
      ) : null}
      {item.kind === 'join' && item.value.requester ? (
        <AppText tone="secondary" variant="caption">
          Account: {item.value.requester.isActive === false ? 'Inactive' : 'Active'} ·{' '}
          {item.value.requester.emailVerified ? 'Email verified' : 'Email not verified'}
        </AppText>
      ) : null}
      {item.kind === 'verification' ? (
        <AppText tone="secondary" variant="caption">
          Current membership status: {item.value.status}
        </AppText>
      ) : null}
      {item.kind === 'permissions' ? (
        <AppText tone="secondary" variant="caption">
          Requested access: {item.value.permissionKey.replaceAll('_', ' ')}
        </AppText>
      ) : null}
      {item.kind === 'permissions' && item.value.reason ? (
        <View style={{ gap: 4 }}>
          <AppText variant="caption">Reason</AppText>
          <AppText tone="secondary" variant="body">
            {item.value.reason}
          </AppText>
        </View>
      ) : null}
      {canDecide(item) ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <AppButton
            accessibilityLabel="Approve request"
            disabled={Boolean(savingId)}
            loading={savingId === item.value.id}
            icon={<Check color={colors.onPrimary} size={16} />}
            onPress={() => decision(item, 'approve')}
            style={{ flex: 1 }}
          >
            Approve
          </AppButton>
          <AppButton
            accessibilityLabel={item.kind === 'join' ? 'Decline request' : 'Reject request'}
            disabled={Boolean(savingId)}
            onPress={() => decision(item, 'reject')}
            style={{ flex: 1 }}
            variant="outline"
          >
            {item.kind === 'join' ? 'Decline' : 'Reject'}
          </AppButton>
        </View>
      ) : (
        <AppText tone="secondary" variant="caption">
          This request has already been processed.
        </AppText>
      )}
    </View>
  );

  if (!isReady) {
    return (
      <AppScreen>
        <LoadingState label="Verifying workspace access" variant="fullScreen" />
      </AppScreen>
    );
  }

  if (!categories.length) {
    return (
      <AppScreen padding="md">
        <View style={{ gap: themeTokens.spacing.md }}>
          <AppText accessibilityRole="header" variant="heading">
            Workspace approvals
          </AppText>
          <InlineError message="You are not authorised to review workspace requests." />
          <AppButton
            accessibilityLabel="Back to Inbox"
            onPress={() => router.replace('/(tabs)/inbox')}
            variant="outline"
          >
            Back to Inbox
          </AppButton>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen padding="md">
      <FlatList
        contentContainerStyle={{
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
          gap: themeTokens.spacing.xs,
          paddingBottom: themeTokens.spacing.lg,
        }}
        data={items}
        keyExtractor={(item) => `${item.kind}-${item.value.id}`}
        refreshControl={
          <RefreshControl
            onRefresh={refresh}
            refreshing={refreshing}
            tintColor={colors.primaryAction}
            colors={[colors.primaryAction]}
          />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: themeTokens.spacing.md, marginBottom: themeTokens.spacing.sm }}>
            <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                accessibilityLabel="Back to Inbox"
                accessibilityRole="button"
                onPress={() => router.replace('/(tabs)/inbox')}
                style={{
                  width: themeTokens.touchTarget.minimum,
                  height: themeTokens.touchTarget.minimum,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ArrowLeft color={colors.text} size={20} />
              </Pressable>
              <AppText accessibilityRole="header" style={{ flex: 1 }} variant="heading">
                Workspace approvals
              </AppText>
            </View>
            <SegmentedCategories
              categories={categories}
              onChange={chooseCategory}
              value={activeCategory}
            />
            {notice ? (
              <AppText tone="secondary" variant="caption">
                {notice}
              </AppText>
            ) : null}
            {error ? <InlineError message={error} /> : null}
            {requestId && notice?.includes('no longer') ? (
              <AppButton
                accessibilityLabel="Retry loading request details"
                onPress={refresh}
                variant="outline"
              >
                Refresh request
              </AppButton>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <AppCard
            accessibilityLabel={`Review ${requestTitle(item)}. ${CATEGORY_LABELS[item.kind === 'verification' ? 'verification' : item.kind]}`}
            onPress={() => setSelected(item)}
            padding="sm"
            style={{ gap: themeTokens.spacing.xxs, borderWidth: 0 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ShieldCheck color={colors.primaryAction} size={17} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText numberOfLines={1} variant="label">
                  {requestTitle(item)}
                </AppText>
                <AppText numberOfLines={1} tone="secondary" variant="caption">
                  {requestSubtitle(item)}
                </AppText>
              </View>
              <ChevronRight color={colors.textMuted} size={17} />
            </View>
            <AppText tone="secondary" variant="caption">
              {requestDate(item)}
            </AppText>
          </AppCard>
        )}
        ListEmptyComponent={
          loading ? (
            <LoadingState label={`Loading ${CATEGORY_LABELS[category].toLowerCase()}`} />
          ) : error ? (
            <View style={{ gap: 10, paddingVertical: themeTokens.spacing.md }}>
              <InlineError message={error} />
              <AppButton
                accessibilityLabel="Retry loading approval requests"
                onPress={refresh}
                variant="outline"
              >
                Try again
              </AppButton>
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: 6, paddingVertical: themeTokens.spacing.xl }}>
              <ShieldCheck color={colors.textMuted} size={26} />
              <AppText variant="label">No pending requests</AppText>
              <AppText tone="secondary" variant="caption">
                New {CATEGORY_LABELS[category].toLowerCase()} will appear here.
              </AppText>
            </View>
          )
        }
        ListFooterComponent={
          activeCategory === 'join' && current && current.totalPages > 1 ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <AppButton
                accessibilityLabel="Previous request page"
                disabled={page <= 1}
                onPress={() => setPage((value) => Math.max(1, value - 1))}
                variant="outline"
              >
                Previous
              </AppButton>
              <AppText tone="secondary" variant="caption">
                Page {current.page} of {current.totalPages}
              </AppText>
              <AppButton
                accessibilityLabel="Next request page"
                disabled={page >= current.totalPages}
                onPress={() => setPage((value) => value + 1)}
                variant="outline"
              >
                Next
              </AppButton>
            </View>
          ) : undefined
        }
      />
      <BottomSheet
        onClose={() => setSelected(null)}
        title="Request details"
        visible={Boolean(selected)}
      >
        {selected ? renderDetails(selected) : <View />}
      </BottomSheet>
    </AppScreen>
  );
}
