import { File, Paths } from 'expo-file-system';
import { FileText } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';

import type { ApiBinaryResponse } from '../../api/client';
import { AppText } from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { isImageFile, safeLocalFileName } from '../tasks/fileContracts';

export interface SecureImagePreviewProps {
  fileName: string;
  mimeType: string;
  download: () => Promise<ApiBinaryResponse>;
  size?: number | null;
  accessibilityLabel?: string;
  onPress?: () => void;
}

function isPreviewImage(fileName: string, mimeType: string): boolean {
  return isImageFile(fileName, mimeType) || /\.(gif|jpe?g|png|webp)$/i.test(fileName);
}

function sizeLabel(size: number | null | undefined): string | null {
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function SecureImagePreview({
  fileName,
  mimeType,
  download,
  size,
  accessibilityLabel,
  onPress,
}: SecureImagePreviewProps) {
  const { colors } = useAppTheme();
  const [uri, setUri] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed' | 'unsupported'>(
    isPreviewImage(fileName, mimeType) ? 'loading' : 'unsupported',
  );
  const previewable = isPreviewImage(fileName, mimeType);

  useEffect(() => {
    if (!previewable) return undefined;
    let active = true;
    const cached = new File(
      Paths.cache,
      `admiino-preview-${Date.now()}-${Math.random().toString(36).slice(2)}-${safeLocalFileName(fileName)}`,
    );
    void download()
      .then(async ({ bytes }) => {
        if (!active) return;
        cached.create();
        await cached.write(bytes);
        if (active) {
          setUri(cached.uri);
          setState('ready');
        } else if (cached.exists) {
          cached.delete();
        }
      })
      .catch(() => {
        if (active) setState('failed');
        if (cached.exists) cached.delete();
      });
    return () => {
      active = false;
      if (cached.exists) cached.delete();
    };
  }, [download, fileName, mimeType, previewable]);

  const content =
    state === 'ready' && uri ? (
      <Image
        accessibilityLabel={accessibilityLabel ?? fileName}
        resizeMode="cover"
        source={{ uri }}
        style={{ width: '100%', height: '100%' }}
      />
    ) : state === 'loading' ? (
      <ActivityIndicator
        accessibilityLabel={`Loading preview for ${fileName}`}
        color={colors.primaryAction}
      />
    ) : (
      <View style={{ alignItems: 'center', gap: themeTokens.spacing.xxs }}>
        <FileText color={colors.primaryAction} size={28} />
        <View style={{ maxWidth: '100%' }}>
          <View>
            <FilePreviewText
              color={colors.text}
              text={state === 'failed' ? 'Preview unavailable' : 'Document'}
            />
          </View>
        </View>
      </View>
    );

  const frame = {
    height: 96,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
    borderRadius: themeTokens.radius.sm,
    backgroundColor: colors.surfaceSubtle,
  };

  return (
    <View style={{ gap: themeTokens.spacing.xs }}>
      {onPress ? (
        <Pressable
          accessibilityLabel={accessibilityLabel ?? fileName}
          onPress={onPress}
          style={frame}
        >
          {content}
        </Pressable>
      ) : (
        <View style={frame}>{content}</View>
      )}
      <FilePreviewText color={colors.text} text={fileName} />
      <FilePreviewText
        color={colors.textMuted}
        text={[mimeType || 'File', sizeLabel(size)].filter(Boolean).join(' · ')}
      />
    </View>
  );
}

function FilePreviewText({ color, text }: { color: string; text: string }) {
  return (
    <AppText numberOfLines={2} style={{ color, maxWidth: '100%' }} variant="caption">
      {text}
    </AppText>
  );
}
