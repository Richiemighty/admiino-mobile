import { View } from 'react-native';

import { useAppTheme } from '../../theme';
import { AppText } from './AppText';

interface UserAvatarProps {
  name: string;
  size?: number;
}

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

export function UserAvatar({ name, size = 48 }: UserAvatarProps) {
  const { colors } = useAppTheme();

  return (
    <View
      accessibilityLabel={`${name} avatar`}
      accessibilityRole="image"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primarySurface,
      }}
    >
      <AppText
        style={{
          color: colors.primaryAction,
          fontSize: Math.max(14, size * 0.34),
          fontWeight: '700',
        }}
      >
        {initialsFor(name)}
      </AppText>
    </View>
  );
}
