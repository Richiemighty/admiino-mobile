import { X } from 'lucide-react-native';
import type { PropsWithChildren, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '../../features/onboarding/useReducedMotion';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

interface BottomSheetProps extends PropsWithChildren {
  title: string;
  visible: boolean;
  onClose: () => void;
  footer?: ReactNode;
  testID?: string;
}

export function BottomSheet({
  title,
  visible,
  onClose,
  children,
  footer,
  testID,
}: BottomSheetProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [translateY] = useState(() => new Animated.Value(320));

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      translateY.setValue(0);
      return;
    }
    translateY.setValue(320);
    Animated.spring(translateY, {
      toValue: 0,
      damping: 24,
      stiffness: 240,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, translateY, visible]);

  return (
    <Modal
      accessibilityViewIsModal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: '#00000066',
        }}
      >
        <Pressable
          accessibilityLabel="Close sheet"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <Animated.View
            accessibilityLabel={title}
            testID={testID}
            style={{
              maxHeight: '86%',
              width: '100%',
              maxWidth: 720,
              alignSelf: 'center',
              borderTopLeftRadius: themeTokens.radius.xl,
              borderTopRightRadius: themeTokens.radius.xl,
              backgroundColor: colors.surface,
              paddingTop: themeTokens.spacing.md,
              paddingHorizontal: themeTokens.spacing.lg,
              paddingBottom: Math.max(insets.bottom, themeTokens.spacing.md),
              transform: [{ translateY }],
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: themeTokens.touchTarget.minimum,
                marginBottom: themeTokens.spacing.sm,
              }}
            >
              <AppText accessibilityRole="header" style={{ flex: 1 }} variant="heading">
                {title}
              </AppText>
              <IconButton
                accessibilityLabel={`Close ${title.toLowerCase()}`}
                icon={<X color={colors.text} size={20} />}
                onPress={onClose}
              />
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={{ flexShrink: 1 }}
            >
              <View>{children}</View>
            </ScrollView>
            {footer}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
