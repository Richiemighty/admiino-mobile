import { router } from 'expo-router';
import { Bell, ChevronDown, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import { useInboxCount } from '../../features/inbox/InboxCountProvider';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { AppText } from '../ui/AppText';
import { IconButton } from '../ui/IconButton';
import { UserAvatar } from '../ui/UserAvatar';
import { QuickWorkspaceSwitcher } from './QuickWorkspaceSwitcher';

export function MainAppHeader({ onProfilePress }: { onProfilePress?: () => void } = {}) {
  const { user, activeWorkspace } = useAuth();
  const { unreadCount } = useInboxCount();
  const { colors } = useAppTheme();
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.email ||
    'Admiino user';

  return (
    <>
      <View
        accessibilityRole="header"
        style={{
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
          gap: themeTokens.spacing.sm,
          paddingHorizontal: themeTokens.spacing.md,
          backgroundColor: colors.background,
        }}
      >
        <IconButton
          accessibilityLabel={
            onProfilePress ? 'Open profile and navigation menu' : 'Open My Profile'
          }
          icon={<UserAvatar imageUrl={user?.profilePictureUrl} name={name} size={40} />}
          onPress={() => (onProfilePress ? onProfilePress() : router.push('/profile'))}
        />
        <Pressable
          accessibilityLabel={`Switch workspace, current workspace ${activeWorkspace?.company.name ?? 'not selected'}`}
          accessibilityRole="button"
          onPress={() => setSwitcherVisible(true)}
          style={{
            flex: 1,
            minHeight: 44,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <AppText numberOfLines={1} style={{ maxWidth: 190 }} variant="label">
            {activeWorkspace?.company.name ?? 'Choose workspace'}
          </AppText>
          <ChevronDown color={colors.textMuted} size={16} />
        </Pressable>
        <IconButton
          accessibilityLabel="Open Global Search"
          icon={<Search color={colors.text} size={21} />}
          onPress={() => router.push('/search')}
        />
        <View>
          <IconButton
            accessibilityLabel={
              unreadCount && unreadCount > 0
                ? `Open Inbox, ${unreadCount > 99 ? '99 plus' : unreadCount} unread`
                : 'Open Inbox'
            }
            icon={<Bell color={colors.text} size={21} />}
            onPress={() => router.push('/inbox')}
          />
          {unreadCount && unreadCount > 0 ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                right: 4,
                top: 2,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.primaryAction,
                paddingHorizontal: 3,
              }}
            >
              <AppText style={{ color: colors.onPrimary, fontSize: 9, fontWeight: '700' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
      <QuickWorkspaceSwitcher onClose={() => setSwitcherVisible(false)} visible={switcherVisible} />
    </>
  );
}
