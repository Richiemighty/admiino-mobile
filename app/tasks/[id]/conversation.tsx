import { useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../../src/auth/AuthProvider';
import { TaskConversationScreen } from '../../../src/features/tasks/TaskConversationScreen';

export default function TaskConversationRoute() {
  const { activeWorkspace, user } = useAuth();
  const { id, projectId, fromProject, returnTo, commentId, fromInbox } = useLocalSearchParams<{
    id: string;
    projectId?: string;
    fromProject?: string;
    returnTo?: string;
    commentId?: string;
    fromInbox?: string;
  }>();
  const taskId = Array.isArray(id) ? id[0] : id;
  const contextProjectId = Array.isArray(projectId) ? projectId[0] : projectId;
  const contextCommentId = Array.isArray(commentId) ? commentId[0] : commentId;
  const cameFromProject = Array.isArray(fromProject) ? fromProject[0] === '1' : fromProject === '1';
  const cameFromInbox = Array.isArray(returnTo) ? returnTo[0] === 'inbox' : returnTo === 'inbox';

  return (
    <TaskConversationScreen
      commentId={contextCommentId}
      directFromInbox={Array.isArray(fromInbox) ? fromInbox[0] === '1' : fromInbox === '1'}
      key={`${user?.id ?? ''}:${activeWorkspace?.companyId ?? ''}:${taskId ?? ''}`}
      returnProjectId={cameFromProject ? contextProjectId : undefined}
      returnToInbox={cameFromInbox}
      taskId={taskId ?? ''}
    />
  );
}
