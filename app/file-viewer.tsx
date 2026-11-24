import { useLocalSearchParams } from 'expo-router';

import { useAuth } from '../src/auth/AuthProvider';
import { FileViewerScreen } from '../src/features/tasks/FileViewerScreen';

export default function FileViewerRoute() {
  const { activeWorkspace, user } = useAuth();
  const {
    taskId,
    attachmentId,
    fileName,
    fileType,
    source,
    projectId,
    fromProject,
    returnTo,
    fromInbox,
  } = useLocalSearchParams<{
    taskId: string;
    attachmentId: string;
    fileName?: string;
    fileType?: string;
    source?: string;
    projectId?: string;
    fromProject?: string;
    returnTo?: string;
    fromInbox?: string;
  }>();
  const value = (parameter: string | string[] | undefined) =>
    Array.isArray(parameter) ? parameter[0] : parameter;

  return (
    <FileViewerScreen
      attachmentId={value(attachmentId) ?? ''}
      key={`${user?.id ?? ''}:${activeWorkspace?.companyId ?? ''}:${value(taskId) ?? ''}:${value(attachmentId) ?? ''}`}
      directFromInbox={value(fromInbox) === '1'}
      fileNameHint={value(fileName)}
      fileTypeHint={value(fileType)}
      returnProjectId={value(fromProject) === '1' ? value(projectId) : undefined}
      returnToInbox={value(returnTo) === 'inbox'}
      sourceHint={value(source)}
      taskId={value(taskId) ?? ''}
    />
  );
}
