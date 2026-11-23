import { router, Tabs, useFocusEffect } from 'expo-router';
import { Ellipsis, FolderKanban, Home, Inbox, ListTodo } from 'lucide-react-native';
import { useCallback } from 'react';

import { useAuth } from '../../src/auth/AuthProvider';
import { AppScreen, LoadingState } from '../../src/components/ui';
import { useAppTheme } from '../../src/theme';

export default function MainTabsLayout() {
  const { status, activeWorkspace, workspacePermissionStatus } = useAuth();
  const { colors } = useAppTheme();

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
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryAction,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          minHeight: 60,
          paddingTop: 6,
          paddingBottom: 6,
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
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarAccessibilityLabel: 'Inbox tab',
          tabBarIcon: ({ color, size }) => <Inbox color={color} size={size} />,
        }}
      />
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
