import { describe, expect, it } from '@jest/globals';

import {
  clearConversationDraft,
  clearWorkspaceConversationDrafts,
  conversationDraftKey,
  getConversationDraft,
  saveConversationDraft,
} from './conversationDraft';

const draft = {
  content: 'Private draft',
  parentCommentId: null,
  mentionedUserIds: ['user-2'],
  mentionLabels: { 'user-2': '@Taylor' },
  files: [],
  clientMessageId: null,
  attemptedContent: null,
  attemptedParentCommentId: null,
};

describe('P15 in-memory conversation drafts', () => {
  it('keeps drafts scoped to user, workspace, and task and clears only a switched workspace', () => {
    const activeKey = conversationDraftKey('draft-user', 'draft-workspace-a', 'draft-task');
    const otherWorkspaceKey = conversationDraftKey('draft-user', 'draft-workspace-b', 'draft-task');
    saveConversationDraft(activeKey, draft);
    saveConversationDraft(otherWorkspaceKey, { ...draft, content: 'Other workspace' });

    expect(getConversationDraft(activeKey)?.content).toBe('Private draft');
    const cleared = clearWorkspaceConversationDrafts('draft-workspace-a');
    expect(cleared).toHaveLength(1);
    expect(getConversationDraft(activeKey)).toBeNull();
    expect(getConversationDraft(otherWorkspaceKey)?.content).toBe('Other workspace');
    clearConversationDraft(otherWorkspaceKey);
  });
});
