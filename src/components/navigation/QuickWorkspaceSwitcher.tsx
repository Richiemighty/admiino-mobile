import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { AppText, BottomSheet, InlineError } from '../ui';

export function QuickWorkspaceSwitcher({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { activeWorkspace, workspaces, selectWorkspace, workspaceError, clearWorkspaceError } =
    useAuth();
  const { colors } = useAppTheme();
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const switchInProgress = useRef(false);

  useEffect(() => {
    if (visible) clearWorkspaceError?.();
  }, [clearWorkspaceError, visible]);

  const choose = async (workspaceId: string) => {
    if (switchInProgress.current || workspaceId === activeWorkspace?.companyId) {
      if (workspaceId === activeWorkspace?.companyId) onClose();
      return;
    }
    switchInProgress.current = true;
    setSwitchingId(workspaceId);
    clearWorkspaceError?.();
    const success = await selectWorkspace(workspaceId);
    switchInProgress.current = false;
    setSwitchingId(null);
    if (success) onClose();
  };

  return (
    <BottomSheet
      onClose={onClose}
      testID="quick-workspace-switcher"
      title="Switch workspace"
      visible={visible}
    >
      {workspaceError ? <InlineError message={workspaceError} /> : null}
      <View style={{ gap: themeTokens.spacing.xs, paddingBottom: themeTokens.spacing.sm }}>
        {workspaces.map((workspace) => {
          const selected = workspace.companyId === activeWorkspace?.companyId;
          const switching = switchingId === workspace.companyId;
          return (
            <Pressable
              accessibilityLabel={`Switch to ${workspace.company.name}, ${workspace.role}`}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: switching }}
              disabled={switching}
              key={workspace.companyId}
              onPress={() => void choose(workspace.companyId)}
              style={{
                minHeight: 64,
                flexDirection: 'row',
                alignItems: 'center',
                gap: themeTokens.spacing.sm,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? colors.primaryAction : colors.border,
                borderRadius: themeTokens.radius.md,
                backgroundColor: colors.surface,
                paddingHorizontal: themeTokens.spacing.md,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <AppText numberOfLines={1} variant="label">
                  {workspace.company.name}
                </AppText>
                <AppText tone="secondary" variant="caption">
                  {workspace.role.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </AppText>
              </View>
              {switching ? (
                <ActivityIndicator color={colors.primaryAction} />
              ) : (
                <AppText tone={selected ? 'link' : 'secondary'} variant="caption">
                  {selected ? 'Current' : 'Open'}
                </AppText>
              )}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
