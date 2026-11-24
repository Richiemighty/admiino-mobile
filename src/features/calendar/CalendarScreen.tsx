import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { apiClient, ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { sessionService } from '../../auth/session';
import { MainAppHeader } from '../../components/navigation/MainAppHeader';
import {
  AppCard,
  AppScreen,
  AppText,
  InlineError,
  LoadingState,
  UserAvatar,
} from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';

export interface CalendarAssignee {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
}

export interface CalendarEvent {
  id: string;
  taskId: string;
  title: string;
  start: string;
  priority: string | null;
  status: string | null;
  companyId: string;
  assignees: CalendarAssignee[];
}

function localDateKey(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function parseEvent(value: unknown): CalendarEvent | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.taskId !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.start !== 'string' ||
    typeof record.companyId !== 'string'
  )
    return null;
  const rawAssignees = Array.isArray(record.assignees) ? record.assignees : [];
  const assignees = rawAssignees
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as Record<string, unknown>).id === 'string',
    )
    .map((item) => ({
      id: item.id as string,
      firstName: typeof item.firstName === 'string' ? item.firstName : null,
      lastName: typeof item.lastName === 'string' ? item.lastName : null,
      profilePictureUrl: typeof item.profilePictureUrl === 'string' ? item.profilePictureUrl : null,
    }));
  return {
    id: record.id,
    taskId: record.taskId,
    title: record.title,
    start: record.start,
    priority: typeof record.priority === 'string' ? record.priority : null,
    status: typeof record.status === 'string' ? record.status : null,
    companyId: record.companyId,
    assignees,
  };
}

async function loadCalendarEvents(
  workspaceId: string,
  rangeStart: Date,
  rangeEnd: Date,
  signal: AbortSignal,
): Promise<CalendarEvent[]> {
  const token = await sessionService.getAccessToken();
  const params = new URLSearchParams({
    start: rangeStart.toISOString(),
    end: rangeEnd.toISOString(),
    scope: 'my',
    workspaceId,
  });
  const response = await apiClient.get<unknown>(`/calendar/events?${params.toString()}`, {
    token,
    workspaceId,
    signal,
  });
  if (!response || typeof response !== 'object') {
    throw new ApiError('The calendar response was invalid.', 502);
  }
  const envelope = response as Record<string, unknown>;
  if (envelope.success !== true || !Array.isArray(envelope.events)) {
    throw new ApiError('The calendar response was invalid.', 502);
  }
  return envelope.events
    .map(parseEvent)
    .filter((event): event is CalendarEvent => Boolean(event && event.companyId === workspaceId));
}

function labelFor(value: string | null): string {
  return value
    ? value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Not set';
}

export function CalendarScreen() {
  const { activeWorkspace, status, workspacePermissionStatus } = useAuth();
  const { colors } = useAppTheme();
  const workspaceId = activeWorkspace?.companyId ?? null;
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 12);
  });
  const [selectedDate, setSelectedDate] = useState(
    () => new Date(new Date().setHours(12, 0, 0, 0)),
  );
  const [events, setEvents] = useState<{ workspaceId: string; events: CalendarEvent[] } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (status !== 'authenticated' || workspacePermissionStatus !== 'ready' || !workspaceId)
        return undefined;
      const controller = new AbortController();
      const rangeStart = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0);
      const rangeEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
      setLoading(true);
      setError(null);
      void loadCalendarEvents(workspaceId, rangeStart, rangeEnd, controller.signal)
        .then((loaded) => {
          if (!controller.signal.aborted) setEvents({ workspaceId, events: loaded });
        })
        .catch((loadError) => {
          if (controller.signal.aborted) return;
          if (loadError instanceof ApiNetworkError || loadError instanceof ApiTimeoutError) {
            setError('Calendar could not be loaded while offline. Please try again.');
          } else if (loadError instanceof ApiError && loadError.status === 403) {
            setError('You do not have permission to view these calendar tasks.');
          } else {
            setError('Calendar tasks could not be loaded. Please try again.');
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
      return () => controller.abort();
    }, [month, retry, status, workspaceId, workspacePermissionStatus]),
  );

  const monthEvents = events?.workspaceId === workspaceId ? events.events : [];
  const eventKeys = useMemo(
    () => new Set(monthEvents.map((event) => localDateKey(event.start))),
    [monthEvents],
  );
  const selectedKey = localDateKey(selectedDate);
  const selectedEvents = monthEvents.filter((event) => localDateKey(event.start) === selectedKey);
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(month);
  const todayKey = localDateKey(new Date());

  const moveMonth = (offset: number) => {
    setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1, 12));
  };

  if (status !== 'authenticated') {
    return (
      <AppScreen>
        <LoadingState label="Verifying your account" variant="fullScreen" />
      </AppScreen>
    );
  }

  return (
    <AppScreen edges={['right', 'bottom', 'left']} padding="md">
      <MainAppHeader />
      <ScrollView
        contentContainerStyle={{
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
          gap: themeTokens.spacing.md,
          padding: themeTokens.spacing.md,
          paddingBottom: themeTokens.spacing.lg,
        }}
        refreshControl={
          <RefreshControl
            colors={[colors.primaryAction]}
            onRefresh={() => setRetry((value) => value + 1)}
            refreshing={loading}
            tintColor={colors.primaryAction}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}>
          <AppText accessibilityRole="header" style={{ flex: 1 }} variant="heading">
            Calendar
          </AppText>
          <Pressable
            accessibilityLabel="Go to today"
            accessibilityRole="button"
            onPress={() => {
              const today = new Date(new Date().setHours(12, 0, 0, 0));
              setMonth(new Date(today.getFullYear(), today.getMonth(), 1, 12));
              setSelectedDate(today);
            }}
            style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 10 }}
          >
            <AppText tone="link" variant="caption">
              Today
            </AppText>
          </Pressable>
          <Pressable
            accessibilityLabel="Previous month"
            accessibilityRole="button"
            onPress={() => moveMonth(-1)}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft color={colors.text} size={20} />
          </Pressable>
          <Pressable
            accessibilityLabel="Next month"
            accessibilityRole="button"
            onPress={() => moveMonth(1)}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronRight color={colors.text} size={20} />
          </Pressable>
        </View>
        <AppText variant="label">{monthLabel}</AppText>
        {error ? (
          <InlineError message={error} onRetry={() => setRetry((value) => value + 1)} />
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <View
              key={`${day}-${index}`}
              style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 }}
            >
              <AppText tone="secondary" variant="caption">
                {day}
              </AppText>
            </View>
          ))}
          {Array.from({ length: firstWeekday }).map((_, index) => (
            <View key={`blank-${index}`} style={{ width: `${100 / 7}%`, height: 44 }} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1;
            const date = new Date(month.getFullYear(), month.getMonth(), day, 12);
            const key = localDateKey(date);
            const selected = key === selectedKey;
            const hasTasks = eventKeys.has(key);
            return (
              <View key={key} style={{ width: `${100 / 7}%`, alignItems: 'center', height: 44 }}>
                <Pressable
                  accessibilityLabel={`${new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(date)}${hasTasks ? ', has tasks' : ''}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedDate(date)}
                  style={{
                    width: 40,
                    height: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 20,
                    backgroundColor: selected
                      ? colors.primaryAction
                      : key === todayKey
                        ? colors.primarySurface
                        : 'transparent',
                  }}
                >
                  <AppText tone={selected ? 'inverse' : 'primary'} variant="caption">
                    {day}
                  </AppText>
                  {hasTasks ? (
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 3,
                        width: 4,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: selected ? colors.onPrimary : colors.primaryAction,
                      }}
                    />
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>

        <View style={{ gap: themeTokens.spacing.sm }}>
          <AppText variant="label">
            {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(selectedDate)}
          </AppText>
          {loading ? <LoadingState label="Loading calendar tasks" /> : null}
          {!loading && selectedEvents.length === 0 ? (
            <AppCard padding="md">
              <AppText tone="secondary">No tasks are due on this date.</AppText>
            </AppCard>
          ) : null}
          {selectedEvents.map((event) => (
            <AppCard
              key={event.id}
              accessibilityLabel={`Open task ${event.title}`}
              onPress={() => router.push(`/tasks/${encodeURIComponent(event.taskId)}`)}
              padding="sm"
              style={{ gap: 6, borderWidth: 0 }}
            >
              <AppText numberOfLines={2} variant="label">
                {event.title}
              </AppText>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.xs }}
              >
                <AppText tone="secondary" variant="caption">
                  {labelFor(event.status)}
                </AppText>
                <AppText tone="secondary" variant="caption">
                  ·
                </AppText>
                <AppText tone="secondary" variant="caption">
                  {labelFor(event.priority)} priority
                </AppText>
              </View>
              {event.assignees.length > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {event.assignees.slice(0, 3).map((person, index) => (
                    <View key={person.id} style={{ marginLeft: index === 0 ? 0 : -8 }}>
                      <UserAvatar
                        imageUrl={person.profilePictureUrl}
                        name={
                          [person.firstName, person.lastName].filter(Boolean).join(' ') ||
                          'Assignee'
                        }
                        size={28}
                      />
                    </View>
                  ))}
                  {event.assignees.length > 3 ? (
                    <AppText tone="secondary" variant="caption" style={{ marginLeft: 6 }}>
                      +{event.assignees.length - 3}
                    </AppText>
                  ) : null}
                </View>
              ) : (
                <AppText tone="secondary" variant="caption">
                  Unassigned
                </AppText>
              )}
            </AppCard>
          ))}
        </View>
      </ScrollView>
    </AppScreen>
  );
}
