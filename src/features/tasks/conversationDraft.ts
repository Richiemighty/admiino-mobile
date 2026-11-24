export interface PickedConversationFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface TaskConversationDraft {
  content: string;
  parentCommentId: string | null;
  mentionedUserIds: string[];
  mentionLabels: Record<string, string>;
  files: PickedConversationFile[];
  clientMessageId: string | null;
  attemptedContent: string | null;
  attemptedParentCommentId: string | null;
}

const drafts = new Map<string, TaskConversationDraft>();

export function conversationDraftKey(userId: string, workspaceId: string, taskId: string): string {
  return `${userId}:${workspaceId}:${taskId}`;
}

export function getConversationDraft(key: string): TaskConversationDraft | null {
  const draft = drafts.get(key);
  return draft
    ? {
        ...draft,
        mentionedUserIds: [...draft.mentionedUserIds],
        mentionLabels: { ...draft.mentionLabels },
        files: [...draft.files],
      }
    : null;
}

export function saveConversationDraft(key: string, draft: TaskConversationDraft): void {
  drafts.set(key, {
    ...draft,
    mentionedUserIds: [...draft.mentionedUserIds],
    mentionLabels: { ...draft.mentionLabels },
    files: [...draft.files],
  });
}

export function clearConversationDraft(key: string): TaskConversationDraft | null {
  const draft = getConversationDraft(key);
  drafts.delete(key);
  return draft;
}

export function clearWorkspaceConversationDrafts(workspaceId: string): TaskConversationDraft[] {
  const cleared: TaskConversationDraft[] = [];
  for (const key of drafts.keys()) {
    if (key.split(':')[1] === workspaceId) {
      const draft = clearConversationDraft(key);
      if (draft) cleared.push(draft);
    }
  }
  return cleared;
}
