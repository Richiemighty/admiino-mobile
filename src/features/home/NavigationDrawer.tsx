import type { Href } from 'expo-router';
import {
  Activity,
  Building2,
  CalendarDays,
  ChevronDown,
  Crown,
  Folder,
  FolderKanban,
  Home,
  LayoutTemplate,
  ListTodo,
  LogOut,
  Settings,
  Users,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MobileUser, MobileWorkspace } from '../../api/types';
import { AppButton, AppText, IconButton, UserAvatar } from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { useReducedMotion } from '../onboarding/useReducedMotion';

interface NavigationDrawerProps {
  visible: boolean;
  user: MobileUser | null;
  workspace: MobileWorkspace | null;
  onClose: () => void;
  onNavigate: (route: Href) => void;
  onSwitchWorkspace: () => void;
  onSignOut: () => Promise<void>;
  activeDestination: 'Home' | 'Tasks' | 'Projects' | 'Calendar';
}

const destinations = [
  { label: 'Home', route: '/(tabs)', Icon: Home },
  { label: 'Tasks', route: '/(tabs)/tasks', Icon: ListTodo },
  { label: 'Projects', route: '/(tabs)/projects', Icon: FolderKanban },
  { label: 'Calendar', route: '/(tabs)/calendar', Icon: CalendarDays },
] as const;

export function NavigationDrawer({
  visible,
  user,
  workspace,
  onClose,
  onNavigate,
  onSwitchWorkspace,
  onSignOut,
  activeDestination,
}: NavigationDrawerProps) {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerWidth = Math.min(width * 0.84, 360);
  const [translateX] = useState(() => new Animated.Value(-drawerWidth));
  const [overlayOpacity] = useState(() => new Animated.Value(0));
  const [closing, setClosing] = useState(false);
  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.email ||
    'Admiino user';

  const close = useCallback(
    (afterClose?: () => void) => {
      if (closing) return;
      setClosing(true);
      const finish = () => {
        setClosing(false);
        onClose();
        afterClose?.();
      };
      if (reduceMotion) {
        translateX.setValue(-drawerWidth);
        overlayOpacity.setValue(0);
        finish();
        return;
      }
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -drawerWidth,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(finish);
    },
    [closing, drawerWidth, onClose, overlayOpacity, reduceMotion, translateX],
  );

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      translateX.setValue(0);
      overlayOpacity.setValue(0.42);
      return;
    }
    translateX.setValue(-drawerWidth);
    overlayOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        damping: 24,
        stiffness: 240,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0.42,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [drawerWidth, overlayOpacity, reduceMotion, translateX, visible]);

  const closeGesture = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dx < -18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx < -60) close();
        },
      }),
    [close],
  );

  const signOut = () => {
    close(() => {
      void onSignOut().catch(() => {
        Alert.alert('Sign out failed', 'Your session could not be cleared. Please try again.');
      });
    });
  };

  if (!visible) return null;

  return (
    <>
      <Modal
        accessibilityViewIsModal
        animationType="none"
        onRequestClose={() => close()}
        statusBarTranslucent
        transparent
        visible={visible}
      >
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Animated.View
            style={{
              ...StyleSheet.absoluteFill,
              backgroundColor: '#000000',
              opacity: overlayOpacity,
            }}
          />
          <Pressable
            accessibilityLabel="Close navigation menu"
            accessibilityRole="button"
            onPress={() => close()}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            {...closeGesture.panHandlers}
            style={{
              width: drawerWidth,
              maxWidth: 360,
              height: '100%',
              paddingTop: insets.top + themeTokens.spacing.md,
              paddingBottom: Math.max(insets.bottom, themeTokens.spacing.md),
              paddingHorizontal: themeTokens.spacing.lg,
              backgroundColor: colors.surface,
              transform: [{ translateX }],
            }}
          >
            <View style={{ flex: 1 }}>
              <View
                style={{
                  minHeight: 60,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: themeTokens.spacing.sm,
                  paddingBottom: themeTokens.spacing.lg,
                }}
              >
                <Pressable
                  accessibilityLabel="Open My Profile"
                  accessibilityRole="button"
                  onPress={() => close(() => onNavigate('/profile'))}
                  style={{
                    flex: 1,
                    minHeight: 56,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: themeTokens.spacing.md,
                  }}
                >
                  <UserAvatar imageUrl={user?.profilePictureUrl} name={fullName} size={56} />
                  <View style={{ flex: 1, gap: themeTokens.spacing.xxs }}>
                    <AppText numberOfLines={1} variant="label">
                      {fullName}
                    </AppText>
                    <AppText numberOfLines={1} tone="secondary" variant="caption">
                      {user?.email ?? ''}
                    </AppText>
                  </View>
                  <AppText tone="link" variant="caption">
                    Profile
                  </AppText>
                </Pressable>
                <IconButton
                  accessibilityLabel="Close navigation menu"
                  icon={<X color={colors.textMuted} size={20} />}
                  onPress={() => close()}
                />
              </View>

              <Pressable
                accessibilityLabel={`Switch workspace, current workspace ${workspace?.company.name ?? 'not selected'}`}
                accessibilityRole="button"
                onPress={() => close(onSwitchWorkspace)}
                style={{
                  minHeight: 60,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: themeTokens.spacing.md,
                  paddingHorizontal: themeTokens.spacing.md,
                  marginBottom: themeTokens.spacing.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: themeTokens.radius.md,
                  backgroundColor: colors.surface,
                }}
              >
                <Building2 color={colors.primaryAction} size={20} />
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <AppText numberOfLines={1} variant="label">
                      {workspace?.company.name ?? 'Choose workspace'}
                    </AppText>
                    <AppText tone="secondary" variant="caption">
                      Current workspace
                    </AppText>
                  </View>
                  <ChevronDown color={colors.textMuted} size={18} />
                </View>
              </Pressable>

              <ScrollView
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
              >
                <View style={{ gap: themeTokens.spacing.xs }}>
                  {destinations.map(({ label, route, Icon }) => {
                    const selected = label === activeDestination;
                    return (
                      <Pressable
                        accessibilityLabel={`Navigate to ${label}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        key={label}
                        onPress={() => close(() => onNavigate(route))}
                        style={{
                          minHeight: themeTokens.touchTarget.minimum,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: themeTokens.spacing.md,
                          borderRadius: themeTokens.radius.md,
                          paddingHorizontal: themeTokens.spacing.md,
                          backgroundColor: selected ? colors.primarySurface : 'transparent',
                        }}
                      >
                        <Icon
                          color={selected ? colors.primaryAction : colors.textMuted}
                          size={20}
                        />
                        <AppText tone={selected ? 'link' : 'primary'} variant="label">
                          {label}
                        </AppText>
                      </Pressable>
                    );
                  })}
                  {[
                    { label: 'Portfolio', Icon: Activity, comingSoon: true },
                    { label: 'Templates', Icon: LayoutTemplate, comingSoon: true },
                    { label: 'Team Directory', Icon: Users, comingSoon: true },
                    { label: 'Hire Talent', Icon: Crown, comingSoon: true },
                    { label: 'Harmony', Icon: Users, comingSoon: true },
                    { label: 'Drive', Icon: Folder, comingSoon: true },
                  ].map(({ label, Icon, comingSoon }) => (
                    <Pressable
                      accessibilityLabel={`${label}${comingSoon ? ', Coming soon' : ''}`}
                      accessibilityRole="button"
                      onPress={() =>
                        Alert.alert(
                          label,
                          comingSoon
                            ? `${label} is not yet available in the mobile app.`
                            : 'This feature is unavailable.',
                        )
                      }
                      key={label}
                      style={{
                        minHeight: themeTokens.touchTarget.minimum,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: themeTokens.spacing.md,
                        borderRadius: themeTokens.radius.md,
                        paddingHorizontal: themeTokens.spacing.md,
                        opacity: comingSoon ? 0.72 : 1,
                      }}
                    >
                      <Icon color={colors.textMuted} size={20} />
                      <AppText style={{ flex: 1 }} variant="label">
                        {label}
                      </AppText>
                      {comingSoon ? (
                        <AppText tone="secondary" variant="caption">
                          Coming soon
                        </AppText>
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              <View style={{ paddingTop: themeTokens.spacing.md }}>
                <Pressable
                  accessibilityLabel="Open Settings"
                  accessibilityRole="button"
                  onPress={() => close(() => onNavigate('/settings'))}
                  style={{
                    minHeight: themeTokens.touchTarget.minimum,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: themeTokens.spacing.md,
                    paddingHorizontal: themeTokens.spacing.md,
                  }}
                >
                  <Settings color={colors.textMuted} size={20} />
                  <AppText variant="label">Settings</AppText>
                </Pressable>
                <AppButton
                  accessibilityLabel="Sign out"
                  icon={<LogOut color={colors.textMuted} size={18} />}
                  onPress={signOut}
                  style={{ justifyContent: 'flex-start' }}
                  variant="ghost"
                >
                  Sign Out
                </AppButton>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
