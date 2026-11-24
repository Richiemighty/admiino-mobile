import { randomUUID } from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ArrowLeft, Download, FileText } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, View } from 'react-native';

import { ApiError, ApiNetworkError, ApiTimeoutError } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import {
  AppButton,
  AppScreen,
  AppText,
  IconButton,
  InlineError,
  LoadingState,
} from '../../components/ui';
import { useAppTheme } from '../../theme';
import { themeTokens } from '../../theme/tokens';
import { isImageFile, isSupportedTaskFile, isTextFile, safeLocalFileName } from './fileContracts';
import { taskService } from './service';

interface LoadedFile {
  workspaceId: string;
  taskId: string;
  attachmentId: string;
  file: File;
  fileName: string;
  mimeType: string;
  size: number;
}

function nameFromDisposition(value: string | null): string | null {
  if (!value) return null;
  const match = /filename\*?=(?:UTF-8'')?("?)([^";]+)\1/i.exec(value);
  if (!match?.[2]) return null;
  try {
    return decodeURIComponent(match[2]);
  } catch {
    return match[2];
  }
}

function fileError(error: unknown): string {
  if (error instanceof ApiNetworkError)
    return 'You appear to be offline. Reconnect and try downloading this file again.';
  if (error instanceof ApiTimeoutError) return 'The download timed out. Please try again.';
  if (error instanceof ApiError && error.status === 401)
    return 'Your session has expired. Sign in again to continue.';
  if (error instanceof ApiError && error.status === 403)
    return 'You no longer have permission to open this file.';
  if (error instanceof ApiError && error.status === 404)
    return 'This file is no longer available for this task.';
  if (error instanceof ApiError && error.status === 413)
    return 'This file is larger than the mobile download limit of 20 MB.';
  if (error instanceof ApiError && error.status === 423)
    return 'This workspace is temporarily suspended.';
  if (error instanceof ApiError && error.status === 501) return error.message;
  return 'The file could not be opened securely. Please try again.';
}

function readableSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileViewerScreen({
  taskId,
  attachmentId,
  fileNameHint,
  fileTypeHint,
  sourceHint,
  returnProjectId,
  returnToInbox = false,
  directFromInbox = false,
}: {
  taskId: string;
  attachmentId: string;
  fileNameHint?: string;
  fileTypeHint?: string;
  sourceHint?: string;
  returnProjectId?: string;
  returnToInbox?: boolean;
  directFromInbox?: boolean;
}) {
  const { activeWorkspace, status, workspacePermissionStatus, logout } = useAuth();
  const { colors } = useAppTheme();
  const workspaceId = activeWorkspace?.companyId ?? null;
  const isReady =
    status === 'authenticated' &&
    workspacePermissionStatus === 'ready' &&
    Boolean(workspaceId && taskId && attachmentId);
  const requestKey = `${workspaceId ?? ''}:${taskId}:${attachmentId}`;
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const [textPreview, setTextPreview] = useState<{
    workspaceId: string;
    taskId: string;
    attachmentId: string;
    text: string;
    failed?: boolean;
  } | null>(null);
  const [downloadState, setDownloadState] = useState<{
    key: string;
    status: 'loading' | 'ready' | 'error';
    message?: string;
  }>({ key: '', status: 'loading' });
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<{ key: string; message: string } | null>(null);
  const loading = downloadState.key !== requestKey || downloadState.status === 'loading';
  const error =
    downloadState.key === requestKey && downloadState.status === 'error'
      ? downloadState.message
      : null;
  const currentOpenError = openError?.key === requestKey ? openError.message : null;
  const currentLoaded =
    loaded?.workspaceId === workspaceId &&
    loaded.taskId === taskId &&
    loaded.attachmentId === attachmentId &&
    loaded.file.exists
      ? loaded
      : null;
  const currentTextPreview =
    textPreview?.workspaceId === workspaceId &&
    textPreview.taskId === taskId &&
    textPreview.attachmentId === attachmentId
      ? textPreview
      : null;
  const loadedRef = useRef<LoadedFile | null>(loaded);

  const fallbackToTask = () => {
    if (directFromInbox) {
      router.replace('/(tabs)/inbox');
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace({
      pathname: '/tasks/[id]',
      params: {
        id: taskId,
        ...(returnProjectId ? { projectId: returnProjectId, fromProject: '1' } : {}),
        ...(returnToInbox ? { returnTo: 'inbox' } : {}),
      },
    });
  };

  useEffect(() => {
    if (!isReady || !workspaceId || !taskId || !attachmentId) {
      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    const previousFile = loadedRef.current?.file;
    if (previousFile?.exists) previousFile.delete();
    loadedRef.current = null;

    void (async () => {
      try {
        if (sourceHint === 'google-drive') {
          throw new ApiError(
            'This Google Drive attachment cannot be opened securely in the mobile app.',
            501,
          );
        }

        const details = await taskService.getTask(taskId, workspaceId, controller.signal);
        const taskAttachment = details.task.attachments?.find(
          (attachment) => attachment.id === attachmentId,
        );
        if (taskAttachment?.source === 'google-drive') {
          throw new ApiError(
            'This Google Drive attachment cannot be opened securely in the mobile app.',
            501,
          );
        }

        const resolvedName =
          taskAttachment?.fileName ?? taskAttachment?.name ?? fileNameHint ?? 'Task attachment';
        const hintedType =
          taskAttachment?.mimeType ?? taskAttachment?.fileType ?? fileTypeHint ?? '';
        if (!isSupportedTaskFile(resolvedName, hintedType)) {
          throw new ApiError('This attachment type is not supported in the mobile app.', 415);
        }

        const downloaded = await taskService.downloadAttachment(
          taskId,
          attachmentId,
          workspaceId,
          taskAttachment?.source ?? sourceHint,
          controller.signal,
        );
        if (!active || controller.signal.aborted) return;

        const headerType = downloaded.contentType?.split(';', 1)[0].trim().toLowerCase() ?? '';
        const mimeType =
          headerType && headerType !== 'application/octet-stream' ? headerType : hintedType;
        const serverName = nameFromDisposition(downloaded.contentDisposition);
        const finalName = safeLocalFileName(serverName ?? resolvedName);
        if (!isSupportedTaskFile(finalName, mimeType)) {
          throw new ApiError('The downloaded file type could not be verified.', 415);
        }

        const file = new File(Paths.cache, `admiino-${randomUUID()}-${finalName}`);
        file.create();
        await file.write(downloaded.bytes);
        if (!active || controller.signal.aborted) {
          if (file.exists) file.delete();
          return;
        }
        const nextLoaded = {
          workspaceId,
          taskId,
          attachmentId,
          file,
          fileName: finalName,
          mimeType,
          size: downloaded.bytes.byteLength,
        };
        loadedRef.current = nextLoaded;
        setLoaded(nextLoaded);
        setDownloadState({ key: requestKey, status: 'ready' });
      } catch (downloadError) {
        if (!active || controller.signal.aborted) return;
        if (downloadError instanceof ApiError && downloadError.status === 401) {
          try {
            await logout();
            router.replace('/sign-in');
          } catch {
            setDownloadState({
              key: requestKey,
              status: 'error',
              message: 'Your session could not be cleared safely. Please try again.',
            });
          }
        } else if (downloadError instanceof ApiError && downloadError.status === 423) {
          router.replace('/workspace-suspended');
        } else {
          setDownloadState({
            key: requestKey,
            status: 'error',
            message: fileError(downloadError),
          });
        }
      }
    })();

    return () => {
      active = false;
      controller.abort();
      const currentFile = loadedRef.current;
      if (currentFile?.workspaceId === workspaceId && currentFile.file.exists) {
        currentFile.file.delete();
      }
    };
  }, [
    attachmentId,
    fileNameHint,
    fileTypeHint,
    isReady,
    logout,
    requestKey,
    sourceHint,
    taskId,
    workspaceId,
  ]);

  useEffect(() => {
    if (
      !currentLoaded ||
      !isTextFile(currentLoaded.fileName, currentLoaded.mimeType) ||
      currentLoaded.size > 1024 * 1024
    ) {
      return;
    }
    let active = true;
    void currentLoaded.file.text().then(
      (text) => {
        if (active) {
          setTextPreview({
            workspaceId: currentLoaded.workspaceId,
            taskId: currentLoaded.taskId,
            attachmentId: currentLoaded.attachmentId,
            text,
          });
        }
      },
      () => {
        if (active) {
          setTextPreview({
            workspaceId: currentLoaded.workspaceId,
            taskId: currentLoaded.taskId,
            attachmentId: currentLoaded.attachmentId,
            text: '',
            failed: true,
          });
          setOpenError({
            key: requestKey,
            message: 'This text file could not be previewed.',
          });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [currentLoaded, requestKey]);

  const openFile = async () => {
    if (!currentLoaded || opening) return;
    setOpening(true);
    setOpenError(null);
    try {
      if (await currentLoaded.file.canPreview()) {
        await currentLoaded.file.preview();
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(currentLoaded.file.uri, {
          dialogTitle: `Open ${currentLoaded.fileName}`,
          mimeType: currentLoaded.mimeType,
        });
      } else {
        setOpenError({
          key: requestKey,
          message: 'No compatible preview or Open In app is available on this device.',
        });
      }
    } catch {
      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(currentLoaded.file.uri, {
            dialogTitle: `Open ${currentLoaded.fileName}`,
            mimeType: currentLoaded.mimeType,
          });
        } else {
          setOpenError({
            key: requestKey,
            message: 'The file could not be opened by an app on this device.',
          });
        }
      } catch {
        setOpenError({
          key: requestKey,
          message: 'The file could not be opened by an app on this device.',
        });
      }
    } finally {
      setOpening(false);
    }
  };

  if (!isReady) {
    return (
      <AppScreen>
        {status !== 'authenticated' || workspacePermissionStatus !== 'ready' ? (
          <LoadingState label="Preparing secure file access" variant="fullScreen" />
        ) : (
          <AppText tone="warning" variant="body">
            Choose an active workspace to open this file.
          </AppText>
        )}
      </AppScreen>
    );
  }

  return (
    <AppScreen padding="md">
      <View
        style={{
          width: '100%',
          maxWidth: 720,
          alignSelf: 'center',
          flex: 1,
          gap: themeTokens.spacing.md,
        }}
      >
        <View
          style={{
            minHeight: 48,
            flexDirection: 'row',
            alignItems: 'center',
            gap: themeTokens.spacing.sm,
          }}
        >
          <IconButton
            accessibilityLabel={directFromInbox ? 'Back to Inbox' : 'Back to task'}
            icon={<ArrowLeft color={colors.text} size={22} />}
            onPress={fallbackToTask}
          />
          <AppText
            accessibilityRole="header"
            numberOfLines={1}
            style={{ flex: 1 }}
            variant="heading"
          >
            File
          </AppText>
        </View>

        {loading && <LoadingState label="Downloading authorized file" />}
        {error && <InlineError message={error} />}

        {currentLoaded && (
          <>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.sm }}
            >
              <FileText color={colors.primaryAction} size={22} />
              <View style={{ flex: 1 }}>
                <AppText numberOfLines={2} variant="label">
                  {currentLoaded.fileName}
                </AppText>
                <AppText tone="secondary" variant="caption">
                  {currentLoaded.mimeType} · {readableSize(currentLoaded.size)}
                </AppText>
              </View>
            </View>

            {isImageFile(currentLoaded.fileName, currentLoaded.mimeType) && (
              <View
                style={{
                  flex: 1,
                  minHeight: 240,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: themeTokens.radius.md,
                  backgroundColor: colors.surfaceSubtle,
                  overflow: 'hidden',
                }}
              >
                <Image
                  accessibilityLabel={currentLoaded.fileName}
                  resizeMode="contain"
                  source={{ uri: currentLoaded.file.uri }}
                  style={{ width: '100%', height: '100%' }}
                />
              </View>
            )}

            {isTextFile(currentLoaded.fileName, currentLoaded.mimeType) &&
              (currentLoaded.size > 1024 * 1024 ? (
                <AppText tone="secondary" variant="caption">
                  This text file is too large to preview inline.
                </AppText>
              ) : currentTextPreview ? (
                <ScrollView
                  style={{
                    flex: 1,
                    minHeight: 200,
                    borderRadius: themeTokens.radius.md,
                    backgroundColor: colors.surfaceSubtle,
                    padding: themeTokens.spacing.sm,
                  }}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                >
                  <AppText selectable style={{ lineHeight: 21 }} variant="caption">
                    {currentTextPreview.failed
                      ? 'The text preview is unavailable.'
                      : currentTextPreview.text}
                  </AppText>
                </ScrollView>
              ) : (
                <LoadingState label="Loading text preview" />
              ))}

            <AppButton
              accessibilityLabel="Preview or open file"
              disabled={opening}
              onPress={() => void openFile()}
              variant="outline"
            >
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: themeTokens.spacing.xs }}
              >
                {opening ? (
                  <ActivityIndicator color={colors.primaryAction} />
                ) : (
                  <Download color={colors.primaryAction} size={17} />
                )}
                <AppText variant="label">{opening ? 'Opening…' : 'Preview or Open In'}</AppText>
              </View>
            </AppButton>
            {currentOpenError && <InlineError message={currentOpenError} />}
          </>
        )}
      </View>
    </AppScreen>
  );
}
