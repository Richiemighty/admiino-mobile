import { useFocusEffect } from 'expo-router';
import { ChevronRight, Users } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { AppCard, AppScreen, AppText, InlineError, LoadingState } from '../../components/ui';
import { cacheKeys } from '../../data/cacheKeys';
import { serverCache } from '../../data/serverCache';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { projectService } from '../projects/service';

export function TeamsScreen() {
  const { activeWorkspace, status, user, workspacePermissionStatus } = useAuth();
  const { colors } = useAppTheme();
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const workspaceId = activeWorkspace?.companyId;

  useFocusEffect(
    useCallback(() => {
      if (status !== 'authenticated' || workspacePermissionStatus !== 'ready' || !workspaceId) {
        return undefined;
      }
      const controller = new AbortController();
      const currentUserId = user?.id;
      const key = currentUserId ? cacheKeys.teams(currentUserId, workspaceId) : null;
      const cached = key ? serverCache.get<{ id: string; name: string }[]>(key) : undefined;
      if (cached) {
        setTeams(cached);
        setLoading(false);
      } else setLoading(true);
      setError(null);
      void projectService
        .listTeams(workspaceId, controller.signal)
        .then((items) => {
          if (!controller.signal.aborted) {
            const next = items.map(({ id, name }) => ({ id, name }));
            if (key) serverCache.set(key, next);
            setTeams(next);
          }
        })
        .catch((requestError: unknown) => {
          if (controller.signal.aborted) return;
          setError(
            requestError instanceof ApiError && requestError.status === 403
              ? 'You do not have permission to view teams in this workspace.'
              : 'Teams could not be loaded. Please try again.',
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
      return () => controller.abort();
    }, [status, user, workspaceId, workspacePermissionStatus]),
  );

  if (loading && !teams.length && !error) {
    return (
      <AppScreen>
        <LoadingState label="Loading teams" variant="fullScreen" />
      </AppScreen>
    );
  }

  return (
    <AppScreen padding="md" scrollable>
      <View style={{ gap: themeTokens.spacing.md }}>
        <View>
          <AppText accessibilityRole="header" variant="title">
            Teams
          </AppText>
          <AppText tone="secondary">Workspace teams and their shared work.</AppText>
        </View>
        {error ? <InlineError message={error} /> : null}
        {teams.map((team) => (
          <AppCard
            key={team.id}
            padding="md"
            style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.md }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: themeTokens.radius.md,
                backgroundColor: colors.primarySurface,
              }}
            >
              <Users color={colors.primaryAction} size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="label">{team.name}</AppText>
              <AppText tone="secondary" variant="caption">
                Team details and member management are coming soon.
              </AppText>
            </View>
            <ChevronRight color={colors.textMuted} size={18} />
          </AppCard>
        ))}
        {!teams.length && !error ? (
          <AppText tone="secondary">No teams have been created in this workspace yet.</AppText>
        ) : null}
      </View>
    </AppScreen>
  );
}
