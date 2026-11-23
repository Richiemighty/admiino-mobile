import { router } from 'expo-router';
import { ArrowRightLeft, FolderKanban, Inbox, ListTodo } from 'lucide-react-native';
import { View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import { AppButton, AppCard, AppScreen, AppText } from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';

function firstName(name: string | undefined) {
  return name?.trim().split(/\s+/)[0] || 'there';
}

export function HomeScreen() {
  const { user, activeWorkspace, permissions } = useAuth();
  const { colors } = useAppTheme();
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.email ||
    'Admiino user';

  return (
    <AppScreen scrollable padding="xl">
      <View
        style={{ width: '100%', maxWidth: 720, alignSelf: 'center', gap: themeTokens.spacing.xl }}
      >
        <View style={{ gap: themeTokens.spacing.xs }}>
          <AppText accessibilityRole="header" variant="title">
            Hello, {firstName(user?.firstName)}
          </AppText>
          <AppText tone="secondary">
            Welcome to {activeWorkspace?.company.name ?? 'your workspace'}.
          </AppText>
        </View>

        <AppCard padding="md" style={{ gap: themeTokens.spacing.sm }}>
          <AppText variant="caption" tone="secondary">
            ACTIVE WORKSPACE
          </AppText>
          <AppText variant="heading">{activeWorkspace?.company.name}</AppText>
          <AppText tone="secondary">
            {permissions?.role
              ? permissions.role
                  .replaceAll('_', ' ')
                  .replace(/\b\w/g, (letter) => letter.toUpperCase())
              : 'Membership verified'}
          </AppText>
          <AppButton
            accessibilityLabel="Switch workspace"
            icon={<ArrowRightLeft color={colors.primaryAction} size={18} />}
            onPress={() => router.push('/workspace-select')}
            variant="outline"
          >
            Switch workspace
          </AppButton>
        </AppCard>

        <View style={{ gap: themeTokens.spacing.sm }}>
          <AppText variant="heading">Go to</AppText>
          <AppCard
            accessibilityLabel="Open Tasks"
            onPress={() => router.push('/(tabs)/tasks')}
            padding="md"
            style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.md }}
          >
            <ListTodo color={colors.primaryAction} size={22} />
            <View style={{ flex: 1, gap: themeTokens.spacing.xxs }}>
              <AppText variant="label">Tasks</AppText>
              <AppText tone="secondary">Open your task workspace</AppText>
            </View>
          </AppCard>
          <AppCard
            accessibilityLabel="Open Projects"
            onPress={() => router.push('/(tabs)/projects')}
            padding="md"
            style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.md }}
          >
            <FolderKanban color={colors.primaryAction} size={22} />
            <View style={{ flex: 1, gap: themeTokens.spacing.xxs }}>
              <AppText variant="label">Projects</AppText>
              <AppText tone="secondary">Open your project workspace</AppText>
            </View>
          </AppCard>
          <AppCard
            accessibilityLabel="Open Inbox"
            onPress={() => router.push('/(tabs)/inbox')}
            padding="md"
            style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.md }}
          >
            <Inbox color={colors.primaryAction} size={22} />
            <View style={{ flex: 1, gap: themeTokens.spacing.xxs }}>
              <AppText variant="label">Inbox</AppText>
              <AppText tone="secondary">Workspace activity and requests</AppText>
            </View>
          </AppCard>
        </View>
        <AppText accessibilityLabel={`Signed in as ${name}`} tone="subtle" variant="caption">
          Signed in as {name}
        </AppText>
      </View>
    </AppScreen>
  );
}
