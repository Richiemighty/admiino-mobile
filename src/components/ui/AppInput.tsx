import { useState } from 'react';
import {
  Pressable,
  type StyleProp,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { AppText } from './AppText';

export interface AppInputProps extends Omit<
  TextInputProps,
  'value' | 'onChangeText' | 'editable' | 'secureTextEntry' | 'style'
> {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
  secureTextEntry?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export function AppInput({
  label,
  value,
  onChangeText,
  hint,
  error,
  disabled = false,
  secureTextEntry = false,
  containerStyle,
  inputStyle,
  onFocus,
  onBlur,
  accessibilityHint,
  ...inputProps
}: AppInputProps) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const borderColor = error
    ? colors.semantic.danger.foreground
    : focused
      ? colors.focus
      : colors.border;

  return (
    <View style={[{ gap: themeTokens.spacing.xs }, containerStyle]}>
      <AppText nativeID={`${label}-label`} variant="label">
        {label}
      </AppText>
      <View
        style={{
          minHeight: themeTokens.touchTarget.minimum,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: focused || error ? 2 : 1,
          borderColor,
          borderRadius: themeTokens.radius.sm,
          backgroundColor: disabled ? colors.surfaceSubtle : colors.surface,
          paddingHorizontal: themeTokens.spacing.md,
        }}
      >
        <TextInput
          {...inputProps}
          accessibilityHint={error ?? hint ?? accessibilityHint}
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          editable={!disabled}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onChangeText={onChangeText}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry && !revealed}
          style={[
            {
              flex: 1,
              minHeight: themeTokens.touchTarget.minimum - 2,
              color: colors.text,
              paddingVertical: themeTokens.spacing.xs,
              fontSize: themeTokens.typography.body.fontSize,
            },
            inputStyle,
          ]}
          value={value}
        />
        {secureTextEntry && (
          <Pressable
            accessibilityLabel={`${revealed ? 'Hide' : 'Show'} ${label}`}
            accessibilityRole="button"
            onPress={() => setRevealed((current) => !current)}
            style={{ minHeight: 44, justifyContent: 'center', paddingLeft: themeTokens.spacing.xs }}
          >
            <AppText tone="link" variant="caption">
              {revealed ? 'Hide' : 'Show'}
            </AppText>
          </Pressable>
        )}
      </View>
      {error ? (
        <AppText accessibilityRole="alert" tone="danger" variant="caption">
          {error}
        </AppText>
      ) : (
        hint && (
          <AppText tone="secondary" variant="caption">
            {hint}
          </AppText>
        )
      )}
    </View>
  );
}
