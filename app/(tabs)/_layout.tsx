import { router, Tabs, useFocusEffect } from 'expo-router';
import { CalendarDays, Ellipsis, FolderKanban, Home, ListTodo } from 'lucide-react-native';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../src/auth/AuthProvider';
import { AppScreen, LoadingState } from '../../src/components/ui';
import { InboxCountProvider } from '../../src/features/inbox/InboxCountProvider';
import { useAppTheme } from '../../src/theme';

export default function MainTabsLayout() {
  const { status, activeWorkspace, workspacePermissionStatus } = useAuth();

  useFocusEffect(
    useCallback(() => {
      if (status === 'restoring') return;
      if (status === 'signed-out') {
        router.replace('/sign-in');
      } else if (status !== 'authenticated') {
        router.replace('/authenticated');
      } else if (workspacePermissionStatus === 'suspended') {
        router.replace('/workspace-suspended');
      } else if (workspacePermissionStatus === 'error') {
        router.replace('/workspace-access');
      } else if (!activeWorkspace || workspacePermissionStatus !== 'ready') {
        router.replace('/authenticated');
      }
    }, [status, activeWorkspace, workspacePermissionStatus]),
  );

  if (status !== 'authenticated' || !activeWorkspace || workspacePermissionStatus !== 'ready') {
    return (
      <AppScreen>
        <LoadingState label="Verifying workspace access" variant="fullScreen" />
      </AppScreen>
    );
  }

  return (
    <InboxCountProvider>
      <WorkspaceTabs />
    </InboxCountProvider>
  );
}

function WorkspaceTabs() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryAction,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          minHeight: 60,
          paddingTop: 6,
          paddingBottom: 6 + insets.bottom,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarAccessibilityLabel: 'Tasks tab',
          tabBarIcon: ({ color, size }) => <ListTodo color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projects',
          tabBarAccessibilityLabel: 'Projects tab',
          tabBarIcon: ({ color, size }) => <FolderKanban color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarAccessibilityLabel: 'Calendar tab',
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="inbox" options={{ href: null }} />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarAccessibilityLabel: 'More tab',
          tabBarIcon: ({ color, size }) => <Ellipsis color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
