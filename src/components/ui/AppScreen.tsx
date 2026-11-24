import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '../../theme';
import { type SpacingToken, themeTokens } from '../../theme/tokens';

export interface AppScreenProps extends PropsWithChildren {
  scrollable?: boolean;
  keyboardAvoiding?: boolean;
  edges?: Edge[];
  padding?: SpacingToken;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function AppScreen({
  children,
  scrollable = false,
  keyboardAvoiding = false,
  edges = ['right', 'bottom', 'left'],
  padding = 'md',
  style,
  contentContainerStyle,
}: AppScreenProps) {
  const { colors } = useAppTheme();
  const contentStyle = [
    {
      flexGrow: scrollable ? 1 : undefined,
      padding: themeTokens.spacing[padding],
      backgroundColor: colors.background,
    },
    contentContainerStyle,
  ];
  const content = scrollable ? (
    <ScrollView
      contentContainerStyle={contentStyle}
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={{ flex: 1 }}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, padding: themeTokens.spacing[padding] }, contentContainerStyle]}>
      {children}
    </View>
  );
  const keyboardContent = keyboardAvoiding ? (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  );

  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.background }, style]}>
      {keyboardContent}
    </SafeAreaView>
  );
}
