import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { ArrowLeft, Check, CircleUserRound, FolderKanban, Search, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, TextInput, View } from 'react-native';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { AppScreen, AppText, IconButton, InlineError, LoadingState } from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { type GlobalSearchGroups, globalSearchService } from './service';

type SearchFilter = 'all' | 'tasks' | 'projects' | 'people';
type SearchGroup = Exclude<SearchFilter, 'all'>;

interface RecentSearchState {
  workspaceId: string;
  terms: string[];
}

interface SearchState {
  workspaceId: string;
  query: string;
  groups: GlobalSearchGroups;
}

interface SearchFailure {
  workspaceId: string;
  query: string;
  message: string;
}

const RECENT_SEARCH_LIMIT = 8;
const SEARCH_DEBOUNCE_MS = 400;
const MIN_REQUEST_INTERVAL_MS = 1400;
const FILTERS: { key: SearchFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'projects', label: 'Projects' },
  { key: 'people', label: 'People' },
];

function storageKey(workspaceId: string): string {
  return `admiino.mobile.search-recent.${workspaceId}`;
}

function parseRecentSearches(raw: string | null): string[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every((term) => typeof term === 'string')) {
    throw new Error('Recent search data has an invalid format.');
  }
  return [...new Set(parsed.map((term) => term.trim()).filter(Boolean))].slice(
    0,
    RECENT_SEARCH_LIMIT,
  );
}

function searchErrorMessage(error: unknown): string {
  if (error instanceof ApiNetworkError)
    return 'Search is unavailable while you are offline. Reconnect and try again.';
  if (error instanceof ApiTimeoutError) return 'Search took too long. Please try again.';
  if (error instanceof ApiError && error.status === 429)
    return 'Too many searches. Wait a moment, then try again.';
  return 'Search is temporarily unavailable. Please try again.';
}

function openResult(group: SearchGroup, id: string, title: string) {
  if (group === 'tasks') {
    router.push(`/tasks/${encodeURIComponent(id)}`);
    return;
  }
  if (group === 'people') return;
  const destination = 'Projects';
  Alert.alert(
    `${destination} details are not available yet`,
    `“${title}” was found in the active workspace. Open the ${destination} tab for its current availability.`,
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: `Open ${destination}`,
        onPress: () => router.push('/(tabs)/projects'),
      },
    ],
  );
}

function SearchResultRow({
  group,
  id,
  title,
  subtitle,
}: {
  group: SearchGroup;
  id: string;
  title: string;
  subtitle: string;
}) {
  const { colors } = useAppTheme();
  const Icon = group === 'tasks' ? Check : group === 'projects' ? FolderKanban : CircleUserRound;
  const content = (
    <>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: themeTokens.radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primarySurface,
        }}
      >
        <Icon color={colors.primaryAction} size={20} />
      </View>
      <View style={{ flex: 1, gap: themeTokens.spacing.xxs }}>
        <AppText numberOfLines={1} variant="label">
          {title}
        </AppText>
        <AppText numberOfLines={1} tone="secondary" variant="caption">
          {group === 'people' ? `${subtitle} · Profile unavailable` : subtitle}
        </AppText>
      </View>
    </>
  );

  if (group === 'people') {
    return (
      <View
        accessibilityLabel={`${title}, ${subtitle}. Profile view is not available.`}
        style={{
          minHeight: themeTokens.touchTarget.minimum,
          flexDirection: 'row',
          alignItems: 'center',
          gap: themeTokens.spacing.sm,
          paddingHorizontal: themeTokens.spacing.sm,
          paddingVertical: themeTokens.spacing.xs,
        }}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityLabel={`${title}, ${group}`}
      accessibilityRole="button"
      onPress={() => openResult(group, id, title)}
      style={({ pressed }) => ({
        minHeight: themeTokens.touchTarget.minimum,
        flexDirection: 'row',
        alignItems: 'center',
        gap: themeTokens.spacing.sm,
        paddingHorizontal: themeTokens.spacing.sm,
        paddingVertical: themeTokens.spacing.xs,
        borderRadius: themeTokens.radius.sm,
        backgroundColor: pressed ? colors.surfaceSubtle : 'transparent',
      })}
    >
      {content}
    </Pressable>
  );
}

export function GlobalSearchScreen() {
  const { status, activeWorkspace, workspacePermissionStatus, logout } = useAuth();
  const { colors } = useAppTheme();
  const logoutRef = useRef(logout);
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [recentState, setRecentState] = useState<RecentSearchState | null>(null);
  const [recentError, setRecentError] = useState<{ workspaceId: string; message: string } | null>(
    null,
  );
  const [searchState, setSearchState] = useState<SearchState | null>(null);
  const [searchFailure, setSearchFailure] = useState<SearchFailure | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const lastRequestAt = useRef(0);
  const workspaceId = activeWorkspace?.companyId ?? null;
  const normalizedQuery = query.trim().slice(0, 100);
  const normalizedDebouncedQuery = debouncedQuery.trim().slice(0, 100);
  const querySettled = normalizedQuery === normalizedDebouncedQuery;
  const currentSearch =
    searchState?.workspaceId === workspaceId && searchState.query === normalizedQuery
      ? searchState
      : null;
  const currentFailure =
    searchFailure?.workspaceId === workspaceId && searchFailure.query === normalizedQuery
      ? searchFailure
      : null;
  const recentTerms = recentState?.workspaceId === workspaceId ? recentState.terms : [];
  const currentRecentError = recentError?.workspaceId === workspaceId ? recentError.message : null;
  const isReady =
    status === 'authenticated' && workspacePermissionStatus === 'ready' && Boolean(activeWorkspace);
  const searching =
    normalizedQuery.length >= 2 &&
    (!querySettled || (isReady && !currentSearch && !currentFailure));

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedQuery(query.trim().slice(0, 100)),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    AsyncStorage.getItem(storageKey(workspaceId)).then(
      (stored) => {
        if (!active) return;
        if (stored === null) return;
        try {
          setRecentState({ workspaceId, terms: parseRecentSearches(stored) });
          setRecentError(null);
        } catch {
          setRecentError({
            workspaceId,
            message: 'Recent searches could not be read from this device.',
          });
        }
      },
      () => {
        if (active) {
          setRecentError({
            workspaceId,
            message: 'Recent searches are unavailable on this device.',
          });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (status === 'restoring') return;
    if (status === 'signed-out') {
      router.replace('/sign-in');
      return;
    }
    if (status === 'suspended' || workspacePermissionStatus === 'suspended') {
      router.replace('/workspace-suspended');
      return;
    }
    if (status === 'access-denied' || workspacePermissionStatus === 'access-denied') {
      router.replace('/workspace-access');
      return;
    }
    if (
      status !== 'authenticated' ||
      workspacePermissionStatus === 'error' ||
      !activeWorkspace ||
      workspacePermissionStatus !== 'ready'
    ) {
      router.replace('/authenticated');
    }
  }, [activeWorkspace, status, workspacePermissionStatus]);

  useEffect(() => {
    if (
      !workspaceId ||
      status !== 'authenticated' ||
      workspacePermissionStatus !== 'ready' ||
      normalizedDebouncedQuery.length < 2
    ) {
      return;
    }

    const controller = new AbortController();
    const delay = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt.current));
    const timer = setTimeout(() => {
      if (controller.signal.aborted) return;
      lastRequestAt.current = Date.now();
      void globalSearchService
        .search(normalizedDebouncedQuery, workspaceId, controller.signal)
        .then((groups) => {
          if (controller.signal.aborted) return;
          setSearchState({ workspaceId, query: normalizedDebouncedQuery, groups });
          setSearchFailure(null);
          void (async () => {
            try {
              const stored = await AsyncStorage.getItem(storageKey(workspaceId));
              const nextTerms = [
                normalizedDebouncedQuery,
                ...parseRecentSearches(stored).filter(
                  (term) =>
                    term.toLocaleLowerCase() !== normalizedDebouncedQuery.toLocaleLowerCase(),
                ),
              ].slice(0, RECENT_SEARCH_LIMIT);
              await AsyncStorage.setItem(storageKey(workspaceId), JSON.stringify(nextTerms));
              setRecentState({ workspaceId, terms: nextTerms });
              setRecentError(null);
            } catch {
              setRecentError({
                workspaceId,
                message: 'Search worked, but the recent term could not be saved.',
              });
            }
          })();
        })
        .catch(async (requestError: unknown) => {
          if (controller.signal.aborted) return;
          if (requestError instanceof ApiError) {
            if (requestError.status === 401) {
              try {
                await logoutRef.current();
                router.replace('/sign-in');
              } catch {
                setSearchFailure({
                  workspaceId,
                  query: normalizedDebouncedQuery,
                  message: 'Your session could not be cleared safely. Please try again.',
                });
              }
              return;
            }
            if (requestError.status === 403) {
              router.replace('/workspace-access');
              return;
            }
            if (requestError.status === 423) {
              router.replace('/workspace-suspended');
              return;
            }
          }
          setSearchFailure({
            workspaceId,
            query: normalizedDebouncedQuery,
            message: searchErrorMessage(requestError),
          });
        });
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedDebouncedQuery, retryCount, status, workspaceId, workspacePermissionStatus]);

  if (!isReady) {
    return (
      <AppScreen>
        <LoadingState label="Verifying workspace access" variant="fullScreen" />
      </AppScreen>
    );
  }

  const resultGroups: [SearchGroup, string, GlobalSearchGroups['tasks']][] = [
    ['tasks', 'Tasks', currentSearch?.groups.tasks ?? []],
    ['projects', 'Projects', currentSearch?.groups.projects ?? []],
    ['people', 'People', currentSearch?.groups.people ?? []],
  ];
  const visibleGroups = resultGroups.filter(
    ([key, , results]) => (filter === 'all' || filter === key) && results.length > 0,
  );
  const visibleCount = visibleGroups.reduce((total, [, , results]) => total + results.length, 0);

  return (
    <AppScreen
      scrollable
      padding="lg"
      contentContainerStyle={{
        width: '100%',
        maxWidth: 720,
        alignSelf: 'center',
        gap: themeTokens.spacing.lg,
        paddingBottom: themeTokens.spacing.xl,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}>
        <IconButton
          accessibilityLabel="Back to Home"
          icon={<ArrowLeft color={colors.text} size={22} />}
          onPress={() => router.replace('/(tabs)')}
        />
        <AppText accessibilityRole="header" style={{ flex: 1 }} variant="heading">
          Search
        </AppText>
      </View>

      <View
        style={{
          minHeight: 52,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: themeTokens.radius.md,
          paddingLeft: themeTokens.spacing.sm,
          backgroundColor: colors.surface,
        }}
      >
        <Search color={colors.textMuted} size={20} />
        <TextInput
          accessibilityLabel="Search tasks, projects, and people"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={100}
          onChangeText={setQuery}
          onSubmitEditing={() => {
            Keyboard.dismiss();
            setDebouncedQuery(normalizedQuery);
          }}
          placeholder="Search this workspace"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          style={{
            flex: 1,
            minHeight: 50,
            color: colors.text,
            paddingHorizontal: themeTokens.spacing.sm,
            fontSize: 16,
          }}
          testID="global-search-input"
          value={query}
        />
        {query.length > 0 && (
          <IconButton
            accessibilityLabel="Clear search"
            icon={<X color={colors.textMuted} size={20} />}
            onPress={() => {
              setQuery('');
              setDebouncedQuery('');
              setSearchFailure(null);
              Keyboard.dismiss();
            }}
          />
        )}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: themeTokens.spacing.xs }}>
        {FILTERS.map(({ key, label }) => {
          const selected = filter === key;
          return (
            <Pressable
              accessibilityLabel={`Filter search by ${label}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={key}
              onPress={() => setFilter(key)}
              style={{
                minHeight: themeTokens.touchTarget.minimum,
                minWidth: themeTokens.touchTarget.minimum,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: themeTokens.radius.pill,
                paddingHorizontal: themeTokens.spacing.md,
                backgroundColor: selected ? colors.primarySurface : colors.surface,
                borderWidth: selected ? 0 : 1,
                borderColor: colors.border,
              }}
            >
              <AppText tone={selected ? 'link' : 'secondary'} variant="label">
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {currentRecentError && (
        <AppText accessibilityRole="alert" tone="warning" variant="caption">
          {currentRecentError}
        </AppText>
      )}

      {normalizedQuery.length < 2 ? (
        <View style={{ gap: themeTokens.spacing.sm }}>
          <AppText tone="secondary">
            Enter at least 2 characters to search the active workspace.
          </AppText>
          {recentTerms.length > 0 && (
            <View style={{ gap: themeTokens.spacing.xs }}>
              <AppText variant="label">Recent searches</AppText>
              {recentTerms.map((term) => (
                <Pressable
                  accessibilityLabel={`Search for ${term}`}
                  accessibilityRole="button"
                  key={term}
                  onPress={() => setQuery(term)}
                  style={{
                    minHeight: themeTokens.touchTarget.minimum,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: themeTokens.spacing.sm,
                    paddingHorizontal: themeTokens.spacing.sm,
                  }}
                >
                  <Search color={colors.textMuted} size={17} />
                  <AppText numberOfLines={1} style={{ flex: 1 }}>
                    {term}
                  </AppText>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={{ gap: themeTokens.spacing.sm }}>
          {searching && (
            <View
              accessibilityLabel="Searching the active workspace"
              accessibilityRole="progressbar"
              style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}
            >
              <ActivityIndicator color={colors.primaryAction} />
              <AppText tone="secondary">Searching this workspace…</AppText>
            </View>
          )}

          {currentFailure && (
            <InlineError
              message={currentFailure.message}
              onRetry={() => setRetryCount((count) => count + 1)}
              retryLabel="Retry search"
            />
          )}

          {visibleGroups.map(([key, label, results]) => (
            <View key={key} style={{ gap: themeTokens.spacing.xs }}>
              <AppText accessibilityRole="header" variant="label">
                {label}
              </AppText>
              {results.map((result) => (
                <SearchResultRow
                  group={key}
                  id={result.id}
                  key={`${key}-${result.id}`}
                  subtitle={result.subtitle}
                  title={result.title}
                />
              ))}
            </View>
          ))}

          {!searching && !currentFailure && querySettled && currentSearch && visibleCount === 0 && (
            <AppText
              accessibilityRole="text"
              style={{ paddingVertical: themeTokens.spacing.lg }}
              tone="secondary"
            >
              No {filter === 'all' ? 'matching results' : `${filter} results`} in this workspace.
            </AppText>
          )}
        </View>
      )}
    </AppScreen>
  );
}
